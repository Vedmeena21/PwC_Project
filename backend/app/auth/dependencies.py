from fastapi import Header, HTTPException, status

from app.auth.service import decode_access_token, get_user_by_id


# Rejects pending/rejected accounts and tokens that reference deleted users.
def require_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token   = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer exists")
    if user["status"] != "approved":
        raise HTTPException(
            status_code=403,
            detail=f"Account is {user['status']} — contact admin",
        )

    user.pop("password_hash", None)
    return user


# Admin-only routes call this dependency instead of require_user.
def require_admin(authorization: str = Header(default="")):
    user = require_user(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
