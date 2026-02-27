import os
from supabase import create_client
from dotenv import load_dotenv

# Carregar variáveis de ambiente do .env
load_dotenv()

# Supabase Credentials Loader
url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_KEY", "")
service_key: str = os.getenv("SUPABASE_SERVICE_KEY", key) # Admin fallback

supabase = None
supabase_admin = None
supabase_error = None

try:
    supabase = create_client(url, key)
    supabase_admin = create_client(url, service_key)
except Exception as e:
    import traceback
    supabase_error = str(e) + " | " + traceback.format_exc()
