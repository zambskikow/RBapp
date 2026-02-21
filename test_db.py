import os
from supabase import create_client, Client

url: str = os.getenv("SUPABASE_URL", "https://fanxxrrhtfcxomeklepk.supabase.co")
key: str = os.getenv("SUPABASE_KEY", "sb_publishable_oQZ8fGdQ95t8LVvJoMDavQ_O0ekKMzI")
supabase: Client = create_client(url, key)

response = supabase.table("funcionarios").select("*").execute()
print(response.data)
