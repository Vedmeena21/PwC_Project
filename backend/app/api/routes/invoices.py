import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends

from app.core.config import get_supabase
from app.core.config import get_settings
from app.auth.dependencies import require_user, require_admin
from app.extraction.extractor import extract_invoice_data, SUPPORTED_EXTENSIONS
from app.validation.engine import validate_invoice
from app.rulebook.service import get_active_rulebook
from app.notifications.email import send_invoice_flagged_email
from app.models import ReviewAction

router = APIRouter(prefix="/invoices", tags=["invoices"])

# 10 MB per file — Render free tier RAM is 512 MB, and Groq context is also bounded.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


# ── Shared helpers ────────────────────────────────────────────────────────────

def _log(db, invoice_id: str, action: str, actor: str = "system", details: dict = None):
    """Write a single row to audit_log. Used throughout the processing pipeline."""
    db.table("audit_log").insert({
        "invoice_id": invoice_id,
        "action":     action,
        "actor":      actor,
        "details":    details or {},
    }).execute()


def _setting_enabled(db, key: str) -> bool:
    """Read a boolean app_setting from Supabase. Returns False if missing."""
    res = db.table("app_settings").select("value").eq("key", key).execute()
    return bool(res.data and res.data[0]["value"] == "true")


# ── Background task: full processing pipeline ─────────────────────────────────
# Runs asynchronously after upload so the HTTP response returns immediately.
# Stages: extract → persist line items → validate → persist results → notify
def _process_invoice(invoice_id: str, file_bytes: bytes, filename: str = "invoice.pdf"):
    db       = get_supabase()
    settings = get_settings()

    try:
        # Stage 1 — mark invoice as processing so the UI shows a spinner
        db.table("invoices").update({"status": "processing"}).eq("id", invoice_id).execute()
        _log(db, invoice_id, "processing_started")

        # Stage 2 — extract structured data via the appropriate parser + Groq
        extracted = extract_invoice_data(file_bytes, filename)

        # Stage 2.5 — duplicate detection: if another invoice already exists with
        # the same (invoice_number, vendor_name), flag this one immediately.
        # Prevents double-payment / re-submission fraud.
        # Skip if extraction returned the placeholder values — those aren't real numbers.
        placeholder_numbers = {"UNKNOWN", "", None}
        placeholder_vendors = {"Unknown Vendor", "", None}
        if (
            extracted.invoice_number not in placeholder_numbers
            and extracted.vendor_name not in placeholder_vendors
        ):
            dup = (
                db.table("invoices")
                .select("id")
                .eq("invoice_number", extracted.invoice_number)
                .eq("vendor_name", extracted.vendor_name)
                .neq("id", invoice_id)
                .limit(1)
                .execute()
            )
            if dup.data:
                db.table("invoices").update({
                    "invoice_number": extracted.invoice_number,
                    "vendor_name":    extracted.vendor_name,
                    "status":         "rejected",
                }).eq("id", invoice_id).execute()
                _log(db, invoice_id, "duplicate_detected", details={
                    "original_id": dup.data[0]["id"],
                    "invoice_number": extracted.invoice_number,
                })
                # Persist a single failed check so the UI shows why
                db.table("validation_results").insert({
                    "invoice_id":     invoice_id,
                    "check_name":     "duplicate_check",
                    "check_label":    "Duplicate Detection",
                    "passed":         False,
                    "expected_value": "unique invoice number + vendor",
                    "actual_value":   f"{extracted.invoice_number} / {extracted.vendor_name}",
                    "message":        f"Duplicate of invoice {dup.data[0]['id']}",
                    "severity":       "error",
                }).execute()
                db.table("invoice_recommendations").insert({
                    "invoice_id":    invoice_id,
                    "verdict":       "reject",
                    "confidence":    "high",
                    "summary":       "Duplicate invoice detected — same number & vendor already on file",
                    "total_checks":  1,
                    "passed_checks": 0,
                    "failed_checks": 1,
                }).execute()
                return

        # Stage 3 — backfill invoice header fields first (before line items)
        # so the unique constraint on (invoice_number, vendor_name) is satisfied
        # before any child rows are inserted. Also clears stale data from prior
        # failed attempts on the same invoice record.
        db.table("invoices").update({
            "invoice_number": extracted.invoice_number,
            "vendor_name":    extracted.vendor_name,
            "vendor_email":   extracted.vendor_email,
            "invoice_date":   extracted.invoice_date,
            "po_reference":   extracted.po_reference,
        }).eq("id", invoice_id).execute()

        # Stage 4 — clear any stale line items from a previous failed run,
        # then insert the freshly extracted ones
        db.table("invoice_line_items").delete().eq("invoice_id", invoice_id).execute()
        if extracted.line_items:
            db.table("invoice_line_items").insert([
                {
                    "invoice_id":      invoice_id,
                    "item_category":   item.item_category,
                    "description":     item.description,
                    "quantity":        item.quantity,
                    "quantity_unit":   item.quantity_unit,
                    "unit_rate":       item.unit_rate,
                    "rate_unit":       item.rate_unit,
                    "total_value":     item.total_value,
                    "dimensions":      item.dimensions,
                    "quality_grade":   item.quality_grade,
                    "sequence_number": item.sequence_number,
                }
                for item in extracted.line_items
            ]).execute()

        # Stage 5 — load the currently active rulebook for validation
        active_rulebook      = get_active_rulebook()
        rulebook_rules       = []
        rulebook_version_id  = None

        if active_rulebook:
            rulebook_version_id = active_rulebook.id
            rulebook_rules      = [r.model_dump() for r in active_rulebook.rules]
            # Link the invoice to the specific rulebook version it was validated against
            db.table("invoices").update(
                {"rulebook_version_id": rulebook_version_id}
            ).eq("id", invoice_id).execute()

        # Stage 6 — run the validation engine
        recommendation = validate_invoice(extracted, rulebook_rules)

        # Stage 7 — persist per-check results
        db.table("validation_results").insert([
            {
                "invoice_id":     invoice_id,
                "check_name":     c.check_name,
                "check_label":    c.check_label,
                "passed":         c.passed,
                "expected_value": c.expected_value,
                "actual_value":   c.actual_value,
                "message":        c.message,
                "severity":       c.severity,
            }
            for c in recommendation.checks
        ]).execute()

        # Stage 8 — persist aggregated recommendation
        db.table("invoice_recommendations").insert({
            "invoice_id":    invoice_id,
            "verdict":       recommendation.verdict,
            "confidence":    recommendation.confidence,
            "summary":       recommendation.summary,
            "total_checks":  recommendation.total_checks,
            "passed_checks": recommendation.passed_checks,
            "failed_checks": recommendation.failed_checks,
        }).execute()

        # Stage 9 — set final status:
        # "flagged" if AI recommends reject/review (human must still decide),
        # "pending" if approved (human still confirms).
        final_status = "flagged" if recommendation.verdict != "approve" else "pending"
        db.table("invoices").update({"status": final_status}).eq("id", invoice_id).execute()
        _log(db, invoice_id, "validated", details={
            "verdict": recommendation.verdict, "checks": recommendation.total_checks
        })

        # Stage 10 — send email notification if setting is enabled and AI flagged it
        if _setting_enabled(db, "auto_notify_on_flag") and recommendation.verdict != "approve":
            send_invoice_flagged_email(
                invoice_number=extracted.invoice_number,
                vendor_name=extracted.vendor_name,
                recommendation=recommendation,
                invoice_id=invoice_id,
                frontend_url=settings.frontend_url,
            )
            db.table("notification_log").insert({
                "type":         "invoice_flagged",
                "reference_id": invoice_id,
                "subject":      f"Invoice {extracted.invoice_number} flagged",
                "status":       "sent",
            }).execute()

    except Exception as e:
        # Any failure in the pipeline marks the invoice as extraction_failed
        # so reviewers know to handle it manually.
        db.table("invoices").update({"status": "extraction_failed"}).eq("id", invoice_id).execute()
        _log(db, invoice_id, "processing_failed", details={"error": str(e)})


# ── POST /invoices/upload ─────────────────────────────────────────────────────
# Accepts a PDF, stores it in Supabase Storage, creates the invoice row,
# then hands off to the background task and returns immediately.
# uploaded_by is set to the current user so per-user listing works downstream.
@router.post("/upload")
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current=Depends(require_user),
):
    # Validate file extension against the supported set
    import os
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    db       = get_supabase()
    settings = get_settings()

    # Check Content-Length header first (fast path — no body read needed)
    content_length = file.size  # set by FastAPI from Content-Length header
    if content_length and content_length > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large ({content_length/1024/1024:.1f} MB). Maximum allowed is {MAX_UPLOAD_BYTES//1024//1024} MB. Please compress the PDF or split it into smaller files.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large ({len(file_bytes)/1024/1024:.1f} MB). Maximum allowed is {MAX_UPLOAD_BYTES//1024//1024} MB. Please compress the PDF or split it into smaller files.",
        )
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    # Preserve original extension in storage so the file is identifiable
    file_name    = f"{uuid.uuid4()}{ext}"
    storage_path = f"invoices/{file_name}"

    # Determine MIME type for storage upload
    mime_map = {
        ".pdf":  "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc":  "application/msword",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls":  "application/vnd.ms-excel",
        ".json": "application/json",
        ".txt":  "text/plain",
        ".csv":  "text/csv",
    }
    content_type = mime_map.get(ext, "application/octet-stream")

    # Upload to Supabase Storage. We store only the path and generate
    # short-lived signed URLs on demand (see GET /invoices/{id}/file-url).
    db.storage.from_(settings.supabase_storage_bucket).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": content_type},
    )
    # Cache a 7-day signed URL on the row so the list endpoint stays cheap.
    try:
        signed = db.storage.from_(settings.supabase_storage_bucket).create_signed_url(
            storage_path, 60 * 60 * 24 * 7
        )
        public_url = signed.get("signedURL") or signed.get("signed_url") or ""
    except Exception:
        public_url = ""

    # Create the invoice row with placeholder values — extraction fills them in
    invoice_res = db.table("invoices").insert({
        "invoice_number": f"PENDING-{file_name[:8].upper()}",
        "vendor_name":    "Processing...",
        "pdf_path":       storage_path,
        "pdf_url":        public_url,
        "status":         "pending",
        "uploaded_by":    current["id"],
    }).execute()

    invoice_id = invoice_res.data[0]["id"]
    _log(db, invoice_id, "uploaded", details={"filename": file.filename, "size_bytes": len(file_bytes), "type": ext})

    # Kick off the async pipeline — response returns before processing completes
    # Pass the original filename so the extractor can choose the right parser
    background_tasks.add_task(_process_invoice, invoice_id, file_bytes, file.filename)

    return {
        "invoice_id": invoice_id,
        "status":     "processing",
        "message":    "Invoice uploaded and queued for processing",
    }


# ── GET /invoices/ ────────────────────────────────────────────────────────────
# Uses the invoice_summary view (joins recommendations + rulebook version).
# Supports filtering by status, search across invoice_number/vendor/po,
# and pagination via limit + offset.
#
# Ownership scoping:
#   - Regular users always see only their own uploads (view param ignored).
#   - Admins see everything by default. Pass view=mine to switch to their
#     own uploads (powers the dashboard's Admin view ↔ My view toggle).
@router.get("/")
async def list_invoices(
    status: str = None,
    search: str = None,
    limit: int  = 50,
    offset: int = 0,
    view: str   = "all",
    current=Depends(require_user),
):
    db = get_supabase()

    # Decide whether to scope to the current user. The view query param is
    # only honoured for admins; non-admins are always scoped to themselves.
    scope_to_user = current["role"] != "admin" or view == "mine"

    def _apply_filters(q):
        if scope_to_user:
            q = q.eq("uploaded_by", current["id"])
        if status:
            q = q.eq("status", status)
        if search:
            pattern = f"%{search}%"
            q = q.or_(
                f"invoice_number.ilike.{pattern},vendor_name.ilike.{pattern},po_reference.ilike.{pattern}"
            )
        return q

    count_res = _apply_filters(
        db.table("invoice_summary").select("id", count="exact")
    ).execute()
    total = count_res.count or 0

    res = _apply_filters(
        db.table("invoice_summary").select("*").order("uploaded_at", desc=True)
    ).range(offset, offset + limit - 1).execute()

    return {"invoices": res.data, "total": total, "limit": limit, "offset": offset}


# ── GET /invoices/stats/summary ───────────────────────────────────────────────
# Aggregates invoice counts per status for the dashboard stat cards.
# Note: head=True in the Supabase Python client does NOT populate .count reliably
# (it returns 0 regardless of actual row count). We fetch all statuses in one
# query and group in Python — single round-trip, no client bug.
# Must be defined BEFORE /{invoice_id} to avoid route conflict.
@router.get("/stats/summary")
async def get_stats(view: str = "all", current=Depends(require_user)):
    db = get_supabase()
    statuses = ["pending", "processing", "approved", "rejected", "flagged", "extraction_failed"]

    scope_to_user = current["role"] != "admin" or view == "mine"
    q = db.table("invoices").select("status")
    if scope_to_user:
        q = q.eq("uploaded_by", current["id"])
    rows = (q.execute().data or [])

    counts: dict = {s: 0 for s in statuses}
    for row in rows:
        s = row.get("status")
        if s in counts:
            counts[s] += 1

    counts["total"] = len(rows)
    return counts


# ── GET /invoices/activity/recent ────────────────────────────────────────────
# Returns the last N audit_log entries that have an invoice_id, joined with
# the invoice number + vendor so the dashboard can show a meaningful feed.
# Must be defined BEFORE /{invoice_id} to avoid route conflict.
@router.get("/activity/recent")
async def recent_activity(limit: int = 8, view: str = "all", current=Depends(require_user)):
    db = get_supabase()
    scope_to_user = current["role"] != "admin" or view == "mine"

    # Fetch recent audit log rows that are invoice-related
    q = (
        db.table("audit_log")
        .select("id, invoice_id, action, actor, details, created_at")
        .not_.is_("invoice_id", "null")
        .order("created_at", desc=True)
        .limit(limit * 3)   # fetch more then filter, since we scope after
    )
    rows = q.execute().data or []

    if not rows:
        return {"activity": []}

    # Gather invoice ids so we can fetch invoice_number + vendor in one shot
    invoice_ids = list({r["invoice_id"] for r in rows})
    inv_res = (
        db.table("invoice_summary")
        .select("id, invoice_number, vendor_name, uploaded_by")
        .in_("id", invoice_ids)
        .execute()
    )
    inv_map = {i["id"]: i for i in (inv_res.data or [])}

    # Filter by ownership if scoped, then trim to limit
    activity = []
    for r in rows:
        inv = inv_map.get(r["invoice_id"])
        if not inv:
            continue
        if scope_to_user and inv.get("uploaded_by") != current["id"]:
            continue
        activity.append({
            "id":             r["id"],
            "invoice_id":     r["invoice_id"],
            "invoice_number": inv.get("invoice_number", "—"),
            "vendor_name":    inv.get("vendor_name", "—"),
            "action":         r["action"],
            "actor":          r["actor"],
            "details":        r["details"],
            "created_at":     r["created_at"],
        })
        if len(activity) >= limit:
            break

    return {"activity": activity}


# ── Ownership check helper ───────────────────────────────────────────────────
# Owner or admin only. Used by every per-invoice endpoint to ensure a regular
# user can't read or mutate another user's invoice by guessing the URL.
def _assert_can_access(invoice: dict, current: dict):
    if current["role"] == "admin":
        return
    if invoice.get("uploaded_by") != current["id"]:
        raise HTTPException(status_code=404, detail="Invoice not found")


# ── GET /invoices/{invoice_id} ────────────────────────────────────────────────
# Returns full invoice detail: metadata + line items + checks + audit trail.
@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, current=Depends(require_user)):
    db = get_supabase()

    invoice_res = db.table("invoice_summary").select("*").eq("id", invoice_id).limit(1).execute()
    if not invoice_res.data:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = invoice_res.data[0]
    _assert_can_access(invoice, current)

    # Fetch all related data in one go
    line_items_res = db.table("invoice_line_items").select("*").eq("invoice_id", invoice_id).execute()
    checks_res     = db.table("validation_results").select("*").eq("invoice_id", invoice_id).execute()
    audit_res      = db.table("audit_log").select("*").eq("invoice_id", invoice_id).order("created_at").execute()

    return {
        "invoice":           invoice,
        "line_items":        line_items_res.data,
        "validation_checks": checks_res.data,
        "audit_trail":       audit_res.data,
    }


# ── POST /invoices/{invoice_id}/reprocess ────────────────────────────────────
# Re-runs the full extraction + validation pipeline on a previously failed invoice.
# Useful when extraction_failed due to a transient Groq rate-limit or disconnect.
# Also auto-corrects invoices whose status is extraction_failed but already have
# valid recommendation data (status update failed at the very end of the pipeline).
@router.post("/{invoice_id}/reprocess")
async def reprocess_invoice(
    invoice_id: str,
    background_tasks: BackgroundTasks,
    current=Depends(require_user),
):
    db       = get_supabase()
    settings = get_settings()

    inv = db.table("invoices").select("pdf_path,status,id,uploaded_by").eq("id", invoice_id).limit(1).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = inv.data[0]
    _assert_can_access(invoice, current)

    # If the invoice already has a recommendation (extraction actually succeeded but
    # the status update failed), just fix the status and return — no need to re-run.
    rec = db.table("invoice_recommendations").select("verdict").eq("invoice_id", invoice_id).limit(1).execute()
    if rec.data:
        existing_verdict = rec.data[0]["verdict"]
        corrected_status = "pending" if existing_verdict == "approve" else "flagged"
        db.table("invoices").update({"status": corrected_status}).eq("id", invoice_id).execute()
        _log(db, invoice_id, "status_corrected", details={
            "from": invoice["status"],
            "to": corrected_status,
            "reason": "recommendation already existed — status update had failed",
        })
        return {
            "invoice_id": invoice_id,
            "status": corrected_status,
            "message": "Status corrected from existing recommendation data (no re-extraction needed)",
        }

    # Truly failed — download file from storage and re-run the full pipeline
    pdf_path = invoice.get("pdf_path")
    if not pdf_path:
        raise HTTPException(status_code=400, detail="No file path stored for this invoice — cannot reprocess")

    try:
        file_bytes = db.storage.from_(settings.supabase_storage_bucket).download(pdf_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not retrieve invoice file from storage: {e}")

    # Derive original filename from the storage path for correct parser routing
    import os
    filename = os.path.basename(pdf_path)

    # Clear stale failed data before re-running
    db.table("validation_results").delete().eq("invoice_id", invoice_id).execute()
    _log(db, invoice_id, "reprocess_requested")

    background_tasks.add_task(_process_invoice, invoice_id, file_bytes, filename)
    return {
        "invoice_id": invoice_id,
        "status": "processing",
        "message": "Invoice queued for reprocessing",
    }


# ── POST /invoices/{invoice_id}/review ────────────────────────────────────────
# Records the human reviewer's final decision (approved / rejected).
# Approve / reject is an admin-only function: in a real corporate flow the
# uploader (accountant) and the approver (manager) are different people.
@router.post("/{invoice_id}/review")
async def review_invoice(
    invoice_id: str,
    action: ReviewAction,
    admin=Depends(require_admin),
):
    if action.action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")

    db = get_supabase()
    db.table("invoices").update({
        "status":         action.action,
        "reviewed_at":    datetime.now(timezone.utc).isoformat(),
        "reviewed_by":    admin["name"] or admin["email"],
        "reviewer_notes": action.notes,
    }).eq("id", invoice_id).execute()

    _log(db, invoice_id, action.action, actor=admin["email"], details={"notes": action.notes})

    return {"status": action.action, "message": f"Invoice {action.action} by {admin['name'] or admin['email']}"}


# ── GET /invoices/{invoice_id}/file-url ───────────────────────────────────────
# Returns a fresh short-lived signed URL for the stored invoice file.
# Used by the detail page so links never go stale.
@router.get("/{invoice_id}/file-url")
async def get_invoice_file_url(invoice_id: str, current=Depends(require_user)):
    db       = get_supabase()
    settings = get_settings()

    inv = db.table("invoices").select("pdf_path,uploaded_by").eq("id", invoice_id).limit(1).execute()
    if not inv.data or not inv.data[0].get("pdf_path"):
        raise HTTPException(status_code=404, detail="Invoice file not found")
    _assert_can_access(inv.data[0], current)

    pdf_path = inv.data[0]["pdf_path"]
    signed = db.storage.from_(settings.supabase_storage_bucket).create_signed_url(pdf_path, 3600)
    url = signed.get("signedURL") or signed.get("signed_url") or ""
    return {"url": url, "expires_in": 3600}


# ── DELETE /invoices/{invoice_id} ─────────────────────────────────────────────
# Removes the invoice row + storage file. Cascade handles line items / checks.
@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, current=Depends(require_user)):
    db = get_supabase()
    # Verify the user owns this invoice (or is admin)
    inv = db.table("invoices").select("uploaded_by").eq("id", invoice_id).limit(1).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="Invoice not found")
    _assert_can_access(inv.data[0], current)
    deleted_by = current["email"]
    settings = get_settings()

    inv = db.table("invoices").select("pdf_path,invoice_number").eq("id", invoice_id).limit(1).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pdf_path = inv.data[0].get("pdf_path")

    # Remove storage object first; if it fails we still continue so the DB row
    # doesn't get orphaned. Supabase storage allows missing files gracefully.
    if pdf_path:
        try:
            db.storage.from_(settings.supabase_storage_bucket).remove([pdf_path])
        except Exception:
            pass

    db.table("invoices").delete().eq("id", invoice_id).execute()

    return {"deleted": True, "id": invoice_id, "by": deleted_by}
