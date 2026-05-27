from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends

from app.rulebook.service import (
    list_rulebook_versions, get_rulebook_by_id,
    create_rulebook_version, activate_rulebook,
    diff_rulebook_versions, get_active_rulebook,
)
from app.models import RulebookCreateRequest
from app.notifications.email import send_rulebook_updated_email
from app.core.config import get_supabase
from app.core.auth import require_admin

router = APIRouter(prefix="/rulebook", tags=["rulebook"])


# ── GET /rulebook/ ────────────────────────────────────────────────────────────
# Returns all versions newest-first for the Rulebook manager UI.
@router.get("/")
async def list_versions():
    versions = list_rulebook_versions()
    return {"versions": [v.model_dump() for v in versions]}


# ── GET /rulebook/active ──────────────────────────────────────────────────────
# Returns the currently active version (used by validation and Settings UI).
@router.get("/active")
async def get_active():
    version = get_active_rulebook()
    if not version:
        raise HTTPException(status_code=404, detail="No active rulebook found")
    return version.model_dump()


# ── GET /rulebook/{version_id} ────────────────────────────────────────────────
@router.get("/{version_id}")
async def get_version(version_id: str):
    version = get_rulebook_by_id(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Rulebook version not found")
    return version.model_dump()


# ── POST /rulebook/ ───────────────────────────────────────────────────────────
# Creates a new rulebook version (inactive by default).
# The version is not applied until explicitly activated via /activate.
@router.post("/", dependencies=[Depends(require_admin)])
async def create_version(request: RulebookCreateRequest):
    version = create_rulebook_version(request)

    # Log creation in audit trail (no invoice_id — rulebook-level event)
    db = get_supabase()
    db.table("audit_log").insert({
        "action": "rulebook_created",
        "actor":  request.created_by or "admin",
        "details": {"version_id": version.id, "label": request.label},
    }).execute()

    return version.model_dump()


# ── POST /rulebook/{version_id}/activate ─────────────────────────────────────
# Activates a version, deactivating all others.
# If a previous active version exists, triggers a diff and sends an email.
@router.post("/{version_id}/activate", dependencies=[Depends(require_admin)])
async def activate_version(
    version_id: str,
    background_tasks: BackgroundTasks,
    activated_by: str = "admin",
):
    db = get_supabase()

    # Capture the current active version BEFORE switching — needed for diff
    current_active = get_active_rulebook()

    # Perform the activation (deactivates all others atomically)
    version = activate_rulebook(version_id)

    db.table("audit_log").insert({
        "action":  "rulebook_activated",
        "actor":   activated_by,
        "details": {"version_id": version_id, "label": version.label},
    }).execute()

    # Compute diff and notify team only if there was a previous active version
    if current_active and current_active.id != version_id:
        from datetime import datetime, timezone
        activated_at = datetime.now(timezone.utc)
        diff = diff_rulebook_versions(current_active.id, version_id, activated_by=activated_by, activated_at=activated_at)

        # Send notification in background so the HTTP response isn't delayed
        if _notify_enabled(db) and diff.changes:
            background_tasks.add_task(send_rulebook_updated_email, diff)
            db.table("notification_log").insert({
                "type":         "rulebook_updated",
                "reference_id": version_id,
                "subject":      f"Rulebook Updated — {version.label} v{version.version}",
                "status":       "sent",
            }).execute()

    return version.model_dump()


# ── GET /rulebook/{from_id}/diff/{to_id} ─────────────────────────────────────
# Returns a structured diff between two versions for the Diff UI.
@router.get("/{from_id}/diff/{to_id}")
async def get_diff(from_id: str, to_id: str):
    try:
        diff = diff_rulebook_versions(from_id, to_id)
        return diff.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Helper ────────────────────────────────────────────────────────────────────
def _notify_enabled(db) -> bool:
    """Check whether auto_notify_on_rulebook_update is set to true in settings."""
    res = db.table("app_settings").select("value") \
            .eq("key", "auto_notify_on_rulebook_update").execute()
    return bool(res.data and res.data[0]["value"] == "true")
