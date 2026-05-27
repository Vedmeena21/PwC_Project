from fastapi import Header, HTTPException, status

from app.core.config import get_settings


# ── Admin token dependency ────────────────────────────────────────────────────
# Applied to every state-changing endpoint (POST / PUT / DELETE on resources
# that the frontend gates behind UserLoginModal). The frontend reads the same
# token from VITE_ADMIN_TOKEN and sends it as the X-Admin-Token header.
#
# Defense-in-depth, not real auth: the token is bundled into the frontend JS
# and therefore visible in the browser bundle to anyone who loads the site.
# Its job is to block trivial direct-curl access from someone who only knows
# the Render URL but has never visited the site. Real per-user auth would
# require server-side sessions or signed tokens.
#
# If admin_token is empty (dev fallback), the check is skipped entirely so
# local Uvicorn keeps working without the env var.
def require_admin(x_admin_token: str = Header(default="", alias="X-Admin-Token")):
    expected = get_settings().admin_token
    if not expected:
        return  # dev mode — no token configured, allow through
    if x_admin_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin token",
        )
