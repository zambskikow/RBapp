from pydantic import BaseModel

class SectorCreate(BaseModel):
    nome: str

class LogCreate(BaseModel):
    user_name: str
    permissao: str
    action: str
    details: str

class RotinaBaseCreate(BaseModel):
    nome: str
    setor: str
    frequencia: str
    dia_prazo_padrao: str
    checklist_padrao: list = []
    responsavel: str | None = None

class RotinaBaseUpdate(BaseModel):
    nome: str | None = None
    setor: str | None = None
    frequencia: str | None = None
    dia_prazo_padrao: str | None = None
    checklist_padrao: list | None = None
    responsavel: str | None = None

class MensagemCreate(BaseModel):
    remetente: str
    destinatario: str
    texto: str
    assunto: str = "Sem Assunto"
    lida: bool = False
    data: str | None = None
    excluido_por: list = []
    favorito: bool = False

class MensagemUpdate(BaseModel):
    lida: bool | None = None
    excluido_por: list | None = None
    favorito: bool | None = None

class CargoCreate(BaseModel):
    nome_cargo: str
    telas_permitidas: list = []

class CargoUpdate(BaseModel):
    nome_cargo: str | None = None
    telas_permitidas: list | None = None

class GlobalConfigUpdate(BaseModel):
    brand_name: str | None = None
    brand_logo_url: str | None = None
    accent_color: str | None = None
    slogan: str | None = None
    theme: str | None = None
    menu_order: list | None = None
