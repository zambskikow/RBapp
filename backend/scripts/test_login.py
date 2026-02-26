import os
import requests
import bcrypt
import hashlib
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

def _pre_hash(password: str) -> bytes:
    return hashlib.sha256(password.encode('utf-8')).digest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if bcrypt.checkpw(_pre_hash(plain_password), hashed_password.encode('utf-8')):
            return True
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        if plain_password == hashed_password:
            return True
        return False

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

r = requests.get(f"{SUPABASE_URL}/rest/v1/funcionarios?select=nome,senha&nome=eq.Manager", headers=headers)
data = r.json()
print("Res:", data)
if data:
    h = data[0]['senha']
    print(f"Hash no DB: {h}")
    res = verify_password('123', h)
    print("Verifica 123:", res)
