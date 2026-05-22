from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Invoice Approval System"
    environment: str = "development"

    # ── Supabase ─────────────────────────────────────────────────────────────
    # supabase_service_key must be the service-role key (not anon) so the
    # backend can bypass RLS and write audit logs / storage freely.
    supabase_url: str
    supabase_service_key: str
    supabase_storage_bucket: str = "invoices"  # bucket name created in Supabase dashboard

    # ── Groq ─────────────────────────────────────────────────────────────────
    # Free tier: 14,400 req/day, 30 RPM. Llama 3.3 70B chosen for best
    # structured-JSON extraction quality on the free tier.
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    # ── Resend ───────────────────────────────────────────────────────────────
    # Free tier: 3,000 emails/month, 100/day. resend_from_email must be a
    # verified domain in the Resend dashboard.
    resend_api_key: str
    resend_from_email: str = "invoices@yourdomain.com"
    resend_from_name: str = "Invoice Approval System"

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Allow requests from the Vite dev server and the deployed Vercel frontend.
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"          # reads from backend/.env in local dev
        case_sensitive = False     # GROQ_API_KEY and groq_api_key both work


# lru_cache ensures Settings() is only instantiated once per process —
# avoids re-reading .env on every request.
@lru_cache()
def get_settings() -> Settings:
    return Settings()
