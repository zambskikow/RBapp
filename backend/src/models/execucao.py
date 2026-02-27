from pydantic import BaseModel

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

class ExecucaoUpdate(BaseModel):
    feito: bool
    feito_em: str | None = None
    baixado_por: str | None = None
    subitems: list = []
