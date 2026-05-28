import json
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.config import get_supabase
from app.auth.dependencies import require_admin

router = APIRouter(prefix="/settings", tags=["settings"])

EDITABLE_KEYS = {"auto_notify_on_flag", "auto_notify_on_rulebook_update"}


class RecipientUpdate(BaseModel):
    recipients: List[str]


class SettingUpdate(BaseModel):
    value: str  # "true" | "false" for boolean settings


@router.get("/")
async def get_all_settings():
    db = get_supabase()
    res = db.table("app_settings").select("*").execute()
    return {row["key"]: row["value"] for row in res.data}


@router.get("/recipients")
async def get_recipients():
    db = get_supabase()
    res = db.table("app_settings").select("value") \
            .eq("key", "notification_recipients").execute()
    if not res.data:
        return {"recipients": []}
    return {"recipients": json.loads(res.data[0]["value"])}


# Full replacement list — not append.
@router.put("/recipients", dependencies=[Depends(require_admin)])
async def update_recipients(body: RecipientUpdate):
    db = get_supabase()
    db.table("app_settings").update({
        "value":      json.dumps(body.recipients),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("key", "notification_recipients").execute()
    return {"recipients": body.recipients, "message": "Recipients updated"}


# Only EDITABLE_KEYS are allowed to prevent arbitrary DB writes via this endpoint.
@router.put("/{key}", dependencies=[Depends(require_admin)])
async def update_setting(key: str, body: SettingUpdate):
    if key not in EDITABLE_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown or non-editable key: {key}")
    db = get_supabase()
    db.table("app_settings").update({
        "value": body.value,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("key", key).execute()
    return {"key": key, "value": body.value}
