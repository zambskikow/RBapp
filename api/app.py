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

class MesCreate(BaseModel):
    id: str
    mes: str
    ativo: bool = False
    percent_concluido: int = 0
    atrasados: int = 0
    concluidos: int = 0
    total_execucoes: int = 0
    vencendo: int = 0

class MesUpdate(BaseModel):
    ativo: bool | None = None
    percent_concluido: int | None = None
    atrasados: int | None = None
    concluidos: int | None = None
    total_execucoes: int | None = None
    vencendo: int | None = None

class LogCreate(BaseModel):
    user_name: str
    permissao: str
    action: str
    details: str

class FuncionarioCreate(BaseModel):
    nome: str
    setor: str
    permissao: str
    senha: str
    ativo: bool = True

class FuncionarioUpdate(BaseModel):
    nome: str | None = None
    setor: str | None = None
    permissao: str | None = None
    senha: str | None = None
    ativo: bool | None = None

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

class MensagemCreate(BaseModel):
    remetente: str
    destinatario: str
    texto: str
    lida: bool = False

class MensagemUpdate(BaseModel):
    lida: bool

class ExecucaoCreate(BaseModel):
    cliente_id: int
    rotina: str
    competencia: str
    dia_prazo: str
    drive_link: str = ""
    feito: bool = False
    responsavel: str
    iniciado_em: str
    checklist_gerado: bool = True
    eh_pai: bool = True
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

@app.delete("/api/clientes/{cliente_id}")
def delete_cliente(cliente_id: int):
    response = supabase.table("clientes").delete().eq("id", cliente_id).execute()
    return response.data

# --- Meses ---
@app.get("/api/meses")
def get_meses():
    response = supabase.table("meses").select("*").execute()
    return response.data

@app.post("/api/meses")
def create_mes(mes: MesCreate):
    response = supabase.table("meses").insert(mes.model_dump()).execute()
    return response.data

@app.put("/api/meses/{mes_id}")
def update_mes(mes_id: str, updates: MesUpdate):
    response = supabase.table("meses").update(updates.model_dump(exclude_unset=True)).eq("id", mes_id).execute()
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

@app.delete("/api/setores/{nome}")
def delete_setor(nome: str):
    response = supabase.table("setores").delete().eq("nome", nome).execute()
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

@app.put("/api/funcionarios/{funcionario_id}")
def update_funcionario(funcionario_id: int, updates: FuncionarioUpdate):
    response = supabase.table("funcionarios").update(updates.model_dump(exclude_unset=True)).eq("id", funcionario_id).execute()
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

@app.delete("/api/rotinas_base/{rotina_id}")
def delete_rotina(rotina_id: int):
    response = supabase.table("rotinas_base").delete().eq("id", rotina_id).execute()
    return response.data

# --- Execucoes ---
@app.get("/api/execucoes")
def get_execucoes():
    response = supabase.table("execucoes").select("*").execute()
    return response.data

@app.post("/api/execucoes")
def create_execucao(execucao: ExecucaoCreate):
    response = supabase.table("execucoes").insert(execucao.model_dump()).execute()
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

@app.post("/api/mensagens")
def create_mensagem(msg: MensagemCreate):
    response = supabase.table("mensagens").insert(msg.model_dump()).execute()
    return response.data

@app.put("/api/mensagens/{msg_id}")
def update_mensagem(msg_id: int, updates: MensagemUpdate):
    response = supabase.table("mensagens").update({"lida": updates.lida}).eq("id", msg_id).execute()
    return response.data

# --- Logs ---
@app.get("/api/logs")
def get_logs():
    response = supabase.table("logs").select("*").order("timestamp", desc=True).limit(500).execute()
    return response.data

@app.post("/api/logs")
def create_log(log: LogCreate):
    response = supabase.table("logs").insert(log.model_dump()).execute()
    return response.data
