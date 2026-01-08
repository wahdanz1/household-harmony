from supabase import create_client, Client
from app.config import settings


def get_supabase_client() -> Client:
    """
    Create and return a Supabase client using the service role key.
    
    The service role key bypasses RLS, so all queries MUST explicitly 
    filter by user_id to maintain security. The backend verifies user 
    identity via JWT before making database calls.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
