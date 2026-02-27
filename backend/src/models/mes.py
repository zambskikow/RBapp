from pydantic import BaseModel

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
