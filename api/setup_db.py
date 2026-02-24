import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

print("Tentando criar a tabela cargos_permissoes via API supabase.rpc...")
try:
    # Notice: supabase-js/py cannot run raw SQL natively without an RPC function
    # Setup RPC:
    # Since we can't easily run DDL through REST without an existing RPC function
    # We will inform the user to run the SQL in their Supabase dashboard directly.
    pass
except Exception as e:
    print(e)
