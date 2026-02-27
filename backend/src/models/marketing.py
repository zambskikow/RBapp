from pydantic import BaseModel

class MarketingPostCreate(BaseModel):
    titulo: str
    cliente_id: int | None = None
    plataforma: str
    tipo: str
    status: str = "Ideia"
    data_prevista: str | None = None
    responsavel_id: int | None = None
    copy: str | None = None
    arquivos: list[str] = []
    checklist: list = []
    prioridade: str = "Normal"

class MarketingPostUpdate(BaseModel):
    titulo: str | None = None
    status: str | None = None
    data_prevista: str | None = None
    responsavel_id: int | None = None
    copy: str | None = None
    arquivos: list[str] | None = None
    checklist: list | None = None
    comentarios: list | None = None
    historico: list | None = None
    prioridade: str | None = None

class MarketingCampanhaCreate(BaseModel):
    nome: str
    objetivo: str
    plataforma: str
    orcamento: float | None = 0
    periodo_inicio: str | None = None
    periodo_fim: str | None = None
    kpi_principal: str | None = None
    status: str = "Planejamento"
    metricas: dict = {}

class MarketingCampanhaUpdate(BaseModel):
    nome: str | None = None
    objetivo: str | None = None
    plataforma: str | None = None
    orcamento: float | None = None
    periodo_inicio: str | None = None
    periodo_fim: str | None = None
    status: str | None = None
    metricas: dict | None = None

class MarketingEquipeCreate(BaseModel):
    funcionario_id: int
    funcao: str
    permissoes: list = []

class MarketingEquipeUpdate(BaseModel):
    funcao: str | None = None
    permissoes: list | None = None

class MarketingMetricaCreate(BaseModel):
    plataforma: str
    seguidores: int | None = None
    engajamento: float | None = None
    leads_whatsapp: int | None = None
    posts_publicados: int | None = None
