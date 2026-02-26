import os
from supabase import create_client, Client

# Credentials from app.py
url = "https://khbdbuoryxqiprlkdcpz.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYmRidW9yeXhxaXBybGtkY3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODU4ODcsImV4cCI6MjA4NzI2MTg4N30.1rr3_-LVO6b2PR96lJl8d7vVfHseWwUeAQDY4tdJR-M"

supabase = create_client(url, key)

try:
    # Try to fetch one row to see the columns
    res = supabase.table("clientes").select("*").limit(1).execute()
    if res.data:
        print("Colunas encontradas na tabela 'clientes':")
        print(list(res.data[0].keys()))
    else:
        print("Tabela 'clientes' está vazia, não foi possível determinar as colunas.")
except Exception as e:
    print(f"Erro ao acessar Supabase: {e}")
