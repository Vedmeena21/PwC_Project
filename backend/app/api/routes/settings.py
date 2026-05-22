import json
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import get_supabase

router = APIRouter(prefix="/settings", tags=["settings"])

# Keys the frontend is allowed to update via PUT /settings/{key}
EDITABLE_KEYS = {"auto_notify_on_flag", "auto_notify_on_rulebook_update"}


# ── Request bodies ────────────────────────────────────────────────────────────
class RecipientUpdate(BaseModel):
    recipients: List[str]   # full replacement list of email addresses

class SettingUpdate(BaseModel):
    value: str              # "true" | "false" for boolean settings


# ── GET /settings/ ────────────────────────────────────────────────────────────
# Returns all settings as a flat key→value dict for the Settings page.
@router.get("/")
async def get_all_settings():
    db = get_supabase()
    res = db.table("app_settings").select("*").execute()
    return {row["key"]: row["value"] for row in res.data}


# ── GET /settings/recipients ──────────────────────────────────────────────────
# Returns the parsed list of email recipients (stored as JSON string in DB).
@router.get("/recipients")
async def get_recipients():
    db = get_supabase()
    res = db.table("app_settings").select("value") \
            .eq("key", "notification_recipients").execute()
    if not res.data:
        return {"recipients": []}
    return {"recipients": json.loads(res.data[0]["value"])}


# ── PUT /settings/recipients ──────────────────────────────────────────────────
# Replaces the entire recipients list (full overwrite, not append).
@router.put("/recipients")
async def update_recipients(body: RecipientUpdate):
    db = get_supabase()
    db.table("app_settings").update({
        "value":      json.dumps(body.recipients),  # persist as JSON array string
        "updated_at": "now()",
    }).eq("key", "notification_recipients").execute()
    return {"recipients": body.recipients, "message": "Recipients updated"}


# ── PUT /settings/{key} ───────────────────────────────────────────────────────
# Updates a single boolean setting. Only EDITABLE_KEYS are allowed
# to prevent arbitrary DB writes via this endpoint.
@router.put("/{key}")
async def update_setting(key: str, body: SettingUpdate):
    if key not in EDITABLE_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown or non-editable key: {key}")
    db = get_supabase()
    db.table("app_settings").update({"value": body.value}).eq("key", key).execute()
    return {"key": key, "value": body.value}
