from functools import lru_cache
from pydantic_settings import BaseSettings
from supabase import create_client, Client


class Settings(BaseSettings):
    app_name:    str = "Invoice Approval System"
    environment: str = "development"

    # Supabase — service-role key bypasses RLS for backend writes
    supabase_url:            str
    supabase_service_key:    str
    supabase_storage_bucket: str = "invoices"

    # Groq — Llama 3.3 70B for structured invoice extraction
    groq_api_key: str
    groq_model:   str = "llama-3.3-70b-versatile"

    # Resend — from_email must be a verified domain in the Resend dashboard
    resend_api_key:    str
    resend_from_email: str = "invoices@yourdomain.com"
    resend_from_name:  str = "Invoice Approval System"

    frontend_url: str = "http://localhost:5173"

    # Shared secret for write endpoints. Frontend sends it as X-Admin-Token.
    # Empty string = auth disabled (dev-only fallback so local Uvicorn still
    # works without the env var). In production this MUST be set on Render.
    admin_token: str = ""

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
