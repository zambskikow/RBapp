import os
from supabase import create_client, Client

url = "https://khbdbuoryxqiprlkdcpz.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYmRidW9yeXhxaXBybGtkY3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODU4ODcsImV4cCI6MjA4NzI2MTg4N30.1rr3_-LVO6b2PR96lJl8d7vVfHseWwUeAQDY4tdJR-M"

try:
    supabase = create_client(url, key)
    print("Conectado ao Supabase com sucesso.")
    
    # Tentando inserir uma rotina de teste com o campo responsavel
    test_rotina = {
        "nome": "Teste Diagnóstico",
        "setor": "Fiscal",
        "frequencia": "Mensal",
        "dia_prazo_padrao": "1",
        "checklist_padrao": [],
        "responsavel": "Sistema"
    }
    
    print(f"Tentando inserir rotina de teste: {test_rotina}")
    response = supabase.table("rotinas_base").insert(test_rotina).execute()
    print("Inserção bem sucedida!")
    
    # Limpando o teste
    supabase.table("rotinas_base").delete().eq("nome", "Teste Diagnóstico").execute()
    print("Teste removido.")
    
except Exception as e:
    print(f"\nERRO DETECTADO: {e}")
    if "column \"responsavel\" of relation \"rotinas_base\" does not exist" in str(e):
        print("\nCAUSA CONFIRMADA: A coluna 'responsavel' não existe na tabela 'rotinas_base'.")
    else:
        print("\nOutra causa detectada.")
