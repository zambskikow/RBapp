import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

app = FastAPI()

# Allow CORS for local testing and Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase Client
url: str = os.getenv("SUPABASE_URL", "https://khbdbuoryxqiprlkdcpz.supabase.co")
key: str = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYmRidW9yeXhxaXBybGtkY3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODU4ODcsImV4cCI6MjA4NzI2MTg4N30.1rr3_-LVO6b2PR96lJl8d7vVfHseWwUeAQDY4tdJR-M")

supabase = None
supabase_error = None
try:
    supabase = create_client(url, key)
except Exception as e:
    import traceback
    supabase_error = str(e) + " | " + traceback.format_exc()

# --- Pydantic Models for incoming POST/PUT requests ---
class ClienteCreate(BaseModel):
    razao_social: str
    cnpj: str
    codigo: str
    regime: str
    responsavel_fiscal: str
    rotinas_selecionadas: list = []
    drive_link: str = ""

class SetorCreate(BaseModel):
    nome: str

class FuncionarioCreate(BaseModel):
    nome: str
    setor: str
    permissao: str
    senha: str

class RotinaBaseCreate(BaseModel):
    nome: str
    setor: str
    frequencia: str
    dia_prazo_padrao: str
    checklist_padrao: list = []

class ExecucaoUpdate(BaseModel):
    feito: bool
    feito_em: str | None = None
    subitems: list = []

# --- API Endpoints ---

@app.get("/api/status")
def read_root():
    if supabase is None:
        return {"status": f"FiscalApp API rodando, mas Supabase falhou ao iniciar! Erro: {supabase_error}"}
    return {"status": "FiscalApp API Online e conectada ao Supabase!"}

# --- Clientes ---
@app.get("/api/clientes")
def get_clientes():
    response = supabase.table("clientes").select("*").execute()
    return response.data

@app.post("/api/clientes")
def create_cliente(cliente: ClienteCreate):
    data = cliente.model_dump()
    response = supabase.table("clientes").insert(data).execute()
    return response.data

# --- Meses ---
@app.get("/api/meses")
def get_meses():
    response = supabase.table("meses").select("*").execute()
    return response.data

# --- Setores ---
@app.get("/api/setores")
def get_setores():
    response = supabase.table("setores").select("*").execute()
    return response.data

@app.post("/api/setores")
def create_setor(setor: SetorCreate):
    response = supabase.table("setores").insert(setor.model_dump()).execute()
    return response.data

# --- Funcionarios ---
@app.get("/api/funcionarios")
def get_funcionarios():
    response = supabase.table("funcionarios").select("*").execute()
    return response.data

@app.post("/api/funcionarios")
def create_funcionario(funcionario: FuncionarioCreate):
    response = supabase.table("funcionarios").insert(funcionario.model_dump()).execute()
    return response.data

# --- Rotinas Base ---
@app.get("/api/rotinas_base")
def get_rotinas_base():
    response = supabase.table("rotinas_base").select("*").execute()
    return response.data

@app.post("/api/rotinas_base")
def create_rotina(rotina: RotinaBaseCreate):
    response = supabase.table("rotinas_base").insert(rotina.model_dump()).execute()
    return response.data

# --- Execucoes ---
@app.get("/api/execucoes")
def get_execucoes():
    response = supabase.table("execucoes").select("*").execute()
    return response.data

@app.put("/api/execucoes/{exec_id}")
def update_execucao(exec_id: int, updates: ExecucaoUpdate):
    response = supabase.table("execucoes").update(updates.model_dump(exclude_unset=True)).eq("id", exec_id).execute()
    return response.data

# --- Mensagens ---
@app.get("/api/mensagens")
def get_mensagens():
    response = supabase.table("mensagens").select("*").execute()
    return response.data

# --- Logs ---
@app.get("/api/logs")
def get_logs():
    response = supabase.table("logs").select("*").execute()
    return response.data
