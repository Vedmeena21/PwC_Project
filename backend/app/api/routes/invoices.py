import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks

from app.core.config import get_supabase
from app.core.config import get_settings
from app.extraction.extractor import extract_invoice_data, SUPPORTED_EXTENSIONS
from app.validation.engine import validate_invoice
from app.rulebook.service import get_active_rulebook
from app.notifications.email import send_invoice_flagged_email
from app.models import ReviewAction

router = APIRouter(prefix="/invoices", tags=["invoices"])


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
@router.post("/upload")
async def upload_invoice(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
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

    file_bytes   = await file.read()
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

    # Upload to Supabase Storage (bucket must exist and be set to public)
    db.storage.from_(settings.supabase_storage_bucket).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": content_type},
    )
    public_url = db.storage.from_(settings.supabase_storage_bucket).get_public_url(storage_path)

    # Create the invoice row with placeholder values — extraction fills them in
    invoice_res = db.table("invoices").insert({
        "invoice_number": f"PENDING-{file_name[:8].upper()}",
        "vendor_name":    "Processing...",
        "pdf_path":       storage_path,
        "pdf_url":        public_url,
        "status":         "pending",
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
@router.get("/")
async def list_invoices(status: str = None, limit: int = 50, offset: int = 0):
    db = get_supabase()
    query = db.table("invoice_summary").select("*").limit(limit).offset(offset)
    if status:
        query = query.eq("status", status)   # filter by status when provided
    res = query.execute()
    return {"invoices": res.data, "total": len(res.data)}


# ── GET /invoices/stats/summary ───────────────────────────────────────────────
# Aggregates invoice counts per status for the dashboard stat cards.
# Must be defined BEFORE /{invoice_id} to avoid route conflict.
@router.get("/stats/summary")
async def get_stats():
    db = get_supabase()
    res = db.table("invoices").select("status").execute()

    counts = {s: 0 for s in ["pending", "processing", "approved", "rejected", "flagged", "extraction_failed"]}
    for row in res.data:
        s = row["status"]
        if s in counts:
            counts[s] += 1
    counts["total"] = len(res.data)
    return counts


# ── GET /invoices/{invoice_id} ────────────────────────────────────────────────
# Returns full invoice detail: metadata + line items + checks + audit trail.
@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str):
    db = get_supabase()

    invoice_res = db.table("invoice_summary").select("*").eq("id", invoice_id).limit(1).execute()
    if not invoice_res.data:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Fetch all related data in one go
    line_items_res = db.table("invoice_line_items").select("*").eq("invoice_id", invoice_id).execute()
    checks_res     = db.table("validation_results").select("*").eq("invoice_id", invoice_id).execute()
    audit_res      = db.table("audit_log").select("*").eq("invoice_id", invoice_id).order("created_at").execute()

    return {
        "invoice":           invoice_res.data[0],
        "line_items":        line_items_res.data,
        "validation_checks": checks_res.data,
        "audit_trail":       audit_res.data,
    }


# ── POST /invoices/{invoice_id}/review ────────────────────────────────────────
# Records the human reviewer's final decision (approved / rejected).
@router.post("/{invoice_id}/review")
async def review_invoice(invoice_id: str, action: ReviewAction):
    if action.action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")

    db = get_supabase()
    db.table("invoices").update({
        "status":         action.action,
        "reviewed_at":    datetime.now(timezone.utc).isoformat(),
        "reviewed_by":    action.reviewer_name,
        "reviewer_notes": action.notes,
    }).eq("id", invoice_id).execute()

    _log(db, invoice_id, action.action, actor=action.reviewer_name, details={"notes": action.notes})

    return {"status": action.action, "message": f"Invoice {action.action} by {action.reviewer_name}"}
