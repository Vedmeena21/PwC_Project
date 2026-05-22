from supabase import create_client, Client
from functools import lru_cache
from app.core.config import get_settings


# lru_cache keeps one Supabase client alive for the process lifetime.
# Creating a new client per-request would open unnecessary connections.
@lru_cache()
def get_supabase() -> Client:
    settings = get_settings()
    # service_key bypasses Row Level Security — required for backend writes
    return create_client(settings.supabase_url, settings.supabase_service_key)
