import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

print("Tentando criar a tabela cargos_permissoes via API supabase.rpc...")
try:
    # Aviso: supabase-js/py não pode executar SQL bruto nativamente sem uma função RPC
    # Configuração RPC:
    # Como não podemos executar facilmente o DDL através de REST sem uma função RPC existente
    # Vamos informar o usuário para rodar o SQL em seu dashboard Supabase diretamente.
    pass
except Exception as e:
    print(e)
