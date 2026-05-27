from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt, JWTError

from app.core.config import get_settings, get_supabase


# ── Password hashing ──────────────────────────────────────────────────────────
# bcrypt is the standard; rounds=12 is the modern default (≈250ms/hash).
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


# ── JWT issue / verify ────────────────────────────────────────────────────────
# Tokens carry the user id and role. We still re-fetch the user from the DB on
# every request so a banned / deleted user can't keep using a still-valid token.
def create_access_token(user_id: str, role: str) -> str:
    s = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=s.jwt_expire_hours)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError:
        return None


# ── DB helpers ────────────────────────────────────────────────────────────────
def get_user_by_email(email: str) -> Optional[dict]:
    db = get_supabase()
    res = db.table("users").select("*").eq("email", email.lower().strip()).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    db = get_supabase()
    res = db.table("users").select("*").eq("id", user_id).limit(1).execute()
    return res.data[0] if res.data else None


# ── Public-shape helper ───────────────────────────────────────────────────────
# Strips the password hash before sending a user object out over the API.
def public_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "password_hash"}
