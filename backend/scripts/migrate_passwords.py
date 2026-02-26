"""
Script para Migrar Senhas Plain Text para Hashes Bcrypt na tabela "funcionarios" via Requests REST puro.
"""
import os
import time
import requests
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

# Instanciar gerador bcrypt isolado 
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY precisam estar configuradas no .env")
    exit(1)

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def migrar_senhas():
    print("Iniciando varredura da tabela 'funcionarios' (via REST)...")
    try:
        url_get = f"{SUPABASE_URL}/rest/v1/funcionarios?select=id,nome,senha"
        res = requests.get(url_get, headers=HEADERS)
        
        if not res.ok:
            print(f"Erro ao buscar funcionários: {res.text}")
            return
            
        funcionarios = res.json()

        if not funcionarios:
            print("Nenhum funcionário encontrado.")
            return

        print(f"Encontrados {len(funcionarios)} funcionários. Iniciando hash...")

        count_migrados = 0
        count_ignorados = 0

        for func in funcionarios:
            user_id = func["id"]
            user_nome = func["nome"]
            senha_atual = func.get("senha")

            if not senha_atual:
                print(f"  [X] Usuário {user_nome} não possui senha.")
                continue

            if str(senha_atual).startswith("$2b$"):
                print(f"  [-] Usuário {user_nome} já migrado (Hash Detectado).")
                count_ignorados += 1
                continue

            print(f"  [+] Migrando senha do Usuário '{user_nome}'...")
            novo_hash = get_password_hash(senha_atual)
            
            # Update via REST PATCH
            url_patch = f"{SUPABASE_URL}/rest/v1/funcionarios?id=eq.{user_id}"
            patch_res = requests.patch(url_patch, headers=HEADERS, json={"senha": novo_hash})
            
            if patch_res.ok:
                count_migrados += 1
            else:
                print(f"  [!] Falha ao atualizar: {patch_res.text}")
            
            time.sleep(0.1)

        print("\n--- RESUMO DA MIGRAÇÃO ---")
        print(f"Senhas recém Hasheadas: {count_migrados}")
        print(f"Senhas já seguras: {count_ignorados}")
        print("--------------------------")
        
    except Exception as e:
        print(f"ERRO: {str(e)}")

if __name__ == "__main__":
    migrar_senhas()
