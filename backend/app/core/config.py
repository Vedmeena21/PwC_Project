from functools import lru_cache
from pydantic_settings import BaseSettings
from supabase import create_client, Client


class Settings(BaseSettings):
    app_name:    str = "Invoice Approval System"
    environment: str = "development"

    # service-role key bypasses RLS for backend writes
    supabase_url:            str
    supabase_service_key:    str
    supabase_storage_bucket: str = "invoices"

    groq_api_key: str
    groq_model:   str = "llama-3.3-70b-versatile"

    # from_email must be a verified domain in the Resend dashboard
    resend_api_key:    str
    resend_from_email: str = "invoices@yourdomain.com"
    resend_from_name:  str = "Invoice Approval System"

    frontend_url: str = "http://localhost:5173"

    # kept for backwards compatibility during the auth migration; new endpoints use JWT
    admin_token: str = ""

    # Tokens are HS256-signed; backend re-verifies signature and re-fetches user on every request
    # to ensure a deleted/banned account can't keep using a still-valid token.
    jwt_secret:        str = "change-me-in-production"
    jwt_algorithm:     str = "HS256"
    jwt_expire_hours:  int = 24 * 7   # 7-day sessions

    # admin who can approve/reject signup requests; defaults to the seed admin
    admin_email: str = "ved@example.com"

    # leave empty to disable the "Sign in with Google" button
    google_client_id: str = ""

    class Config:
        env_file      = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


@lru_cache()
def get_supabase() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)
