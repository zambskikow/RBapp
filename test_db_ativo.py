import os
from supabase import create_client

url = 'https://khbdbuoryxqiprlkdcpz.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYmRidW9yeXhxaXBybGtkY3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODU4ODcsImV4cCI6MjA4NzI2MTg4N30.1rr3_-LVO6b2PR96lJl8d7vVfHseWwUeAQDY4tdJR-M'
supabase = create_client(url, key)

try:
    print("Trying to add ativo column...")
    # There is no direct "alter table" via python client unless we use RPC
    # So we'll try to just update a row with Ativo
    res = supabase.table('funcionarios').update({'ativo': True}).eq('id', 1).execute()
    print("Update result:", res)
except Exception as e:
    print("Error:", e)
    
print("Attempting to get rows...")
try:
    res = supabase.table('funcionarios').select('*').limit(1).execute()
    print(res.data)
except Exception as e:
    print(e)
