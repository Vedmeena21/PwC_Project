from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.auth.dependencies import require_user, require_admin
from app.auth.service import (
    create_access_token, get_user_by_email, get_user_by_id,
    hash_password, public_user, verify_password,
)
from app.core.config import get_supabase, get_settings
from app.notifications.email import send_signup_request_email


router = APIRouter(prefix="/auth", tags=["auth"])


# ── Request / response bodies ────────────────────────────────────────────────
class SignupBody(BaseModel):
    email:    EmailStr
    password: str = Field(min_length=4)
    name:     str = Field(min_length=1, max_length=100)
    # Free-form 150-char note shown to admin in the approval queue,
    # e.g. "Hi, I'm the new accountant on the steel team."
    note:     Optional[str] = Field(default=None, max_length=150)


class LoginBody(BaseModel):
    email:    EmailStr
    password: str


class AdminCreateUserBody(BaseModel):
    email:    EmailStr
    password: str = Field(min_length=4)
    name:     str
    role:     str = Field(default="user", pattern="^(user|admin)$")


# ── POST /auth/signup ─────────────────────────────────────────────────────────
# New user submits credentials + optional note. Account is created with
# status=pending and admin is emailed. No JWT is issued yet.
# If a previously-rejected account exists for this email, it is reset to
# pending so the user can re-apply without needing admin to manually delete.
@router.post("/signup")
async def signup(body: SignupBody, background_tasks: BackgroundTasks):
    email = body.email.lower().strip()
    existing = get_user_by_email(email)

    db = get_supabase()
    if existing:
        if existing["status"] == "rejected":
            # Allow re-application — overwrite the rejected record
            db.table("users").update({
                "password_hash": hash_password(body.password),
                "name":          body.name.strip(),
                "status":        "pending",
                "signup_note":   body.note.strip() if body.note else None,
                "approved_at":   None,
                "approved_by":   None,
            }).eq("id", existing["id"]).execute()
        else:
            raise HTTPException(status_code=409, detail="An account with this email already exists")

    else:
        db.table("users").insert({
            "email":         email,
            "password_hash": hash_password(body.password),
            "name":          body.name.strip(),
            "role":          "user",
            "status":        "pending",
            "signup_note":   body.note.strip() if body.note else None,
        }).execute()

    # Notify admin in the background so the HTTP response isn't delayed by
    # Resend latency. Email failure must not break signup.
    background_tasks.add_task(
        send_signup_request_email,
        new_user_email=email,
        new_user_name=body.name.strip(),
        signup_note=body.note.strip() if body.note else None,
    )

    return {
        "status":  "pending_approval",
        "message": "Your access request has been sent. You'll be able to log in once an admin approves it.",
    }


# ── POST /auth/login ──────────────────────────────────────────────────────────
# Issues a JWT on success. Rejects pending / rejected accounts with a 403 so
# the UI can show a clear "your request is awaiting approval" message.
@router.post("/login")
async def login(body: LoginBody):
    user = get_user_by_email(body.email)
    # Single generic error for unknown email + wrong password to avoid
    # leaking which emails exist
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user["status"] == "pending":
        raise HTTPException(status_code=403, detail="Your access request is awaiting admin approval.")
    if user["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Your access request was rejected. Contact the admin.")

    token = create_access_token(user_id=user["id"], role=user["role"])
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user":         public_user(user),
    }


# ── GET /auth/me ──────────────────────────────────────────────────────────────
# Current user from the JWT. Frontend calls this on app boot to restore session.
@router.get("/me")
async def get_me(current=Depends(require_user)):
    return current


# ── GET /auth/users/pending ───────────────────────────────────────────────────
# Approval queue, oldest-first so admins can work through it FIFO.
@router.get("/users/pending")
async def list_pending(_=Depends(require_admin)):
    db = get_supabase()
    res = (
        db.table("users")
        .select("id,email,name,signup_note,created_at")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return {"users": res.data}


# ── GET /auth/users ───────────────────────────────────────────────────────────
# Full user list for the Manage Users page.
@router.get("/users")
async def list_users(_=Depends(require_admin)):
    db = get_supabase()
    res = (
        db.table("users")
        .select("id,email,name,role,status,signup_note,created_at,approved_at,approved_by")
        .order("created_at", desc=True)
        .execute()
    )
    return {"users": res.data}


# ── POST /auth/users ──────────────────────────────────────────────────────────
# Admin-only direct create. Bypasses the approval queue — the account is
# created already approved.
@router.post("/users")
async def admin_create_user(body: AdminCreateUserBody, admin=Depends(require_admin)):
    email = body.email.lower().strip()
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    db = get_supabase()
    res = db.table("users").insert({
        "email":         email,
        "password_hash": hash_password(body.password),
        "name":          body.name.strip(),
        "role":          body.role,
        "status":        "approved",
        "approved_at":   datetime.now(timezone.utc).isoformat(),
        "approved_by":   admin["id"],
    }).execute()

    return public_user(res.data[0])


# ── POST /auth/users/{id}/approve ─────────────────────────────────────────────
@router.post("/users/{user_id}/approve")
async def approve_user(user_id: str, admin=Depends(require_admin)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db = get_supabase()
    db.table("users").update({
        "status":      "approved",
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": admin["id"],
    }).eq("id", user_id).execute()

    return {"status": "approved", "user_id": user_id}


# ── POST /auth/users/{id}/reject ──────────────────────────────────────────────
@router.post("/users/{user_id}/reject")
async def reject_user(user_id: str, admin=Depends(require_admin)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db = get_supabase()
    db.table("users").update({
        "status":      "rejected",
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": admin["id"],
    }).eq("id", user_id).execute()

    return {"status": "rejected", "user_id": user_id}


# ── DELETE /auth/users/{id} ───────────────────────────────────────────────────
# Hard delete. Their invoices fall back to uploaded_by=NULL (ON DELETE SET NULL)
# so historical data is preserved but no longer attributable.
@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You can't delete your own account")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db = get_supabase()
    db.table("users").delete().eq("id", user_id).execute()
    return {"status": "deleted", "user_id": user_id}


# ── POST /auth/google ─────────────────────────────────────────────────────────
# Verifies a Google ID token from the frontend, then:
#   - If the user exists and is approved  → issue our JWT immediately (sign in)
#   - If the user exists but is pending   → 403 (still awaiting admin approval)
#   - If the user exists but is rejected  → 403
#   - If the user is brand new            → create pending account + email admin
#
# We deliberately keep the same admin-approval gate as email/password signup.
# Google auth just removes the need for a password — trust in identity still
# requires an admin to grant access.
class GoogleTokenBody(BaseModel):
    credential: str   # The raw Google ID token string from @react-oauth/google


@router.post("/google")
async def google_auth(body: GoogleTokenBody, background_tasks: BackgroundTasks):
    settings = get_settings()

    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google login is not configured on this server")

    # Verify the ID token with Google's public keys.
    # google-auth does the full verification: signature, audience, expiry.
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        id_info = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    email = id_info.get("email", "").lower().strip()
    name  = id_info.get("name", "") or id_info.get("given_name", "") or email.split("@")[0]

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email address")

    db       = get_supabase()
    existing = get_user_by_email(email)

    if existing:
        if existing["status"] == "approved":
            # Already an approved user — issue JWT just like a normal login
            token = create_access_token(user_id=existing["id"], role=existing["role"])
            return {
                "access_token": token,
                "token_type":   "bearer",
                "user":         public_user(existing),
            }
        elif existing["status"] == "pending":
            raise HTTPException(
                status_code=403,
                detail="Your access request is awaiting admin approval."
            )
        else:  # rejected
            raise HTTPException(
                status_code=403,
                detail="Your access request was rejected. Contact the admin."
            )
    else:
        # New user via Google — create pending account (no password needed)
        db.table("users").insert({
            "email":         email,
            "password_hash": "",     # empty — Google users never use a password
            "name":          name,
            "role":          "user",
            "status":        "pending",
            "signup_note":   "Signed up via Google",
        }).execute()

        # Notify admin
        background_tasks.add_task(
            send_signup_request_email,
            new_user_email=email,
            new_user_name=name,
            signup_note="Signed up via Google",
        )

        return {
            "status":  "pending_approval",
            "message": "Your access request has been sent. You'll be able to log in once an admin approves it.",
        }
