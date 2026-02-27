from pydantic import BaseModel

class ClienteCreate(BaseModel):
    razao_social: str
    cnpj: str
    codigo: str
    regime: str
    responsavel_fiscal: str | None = None
    rotinas_selecionadas: list = []
    drive_link: str = ""
    inscricao_estadual: str = ""
    inscricao_municipal: str = ""
    data_abertura: str = ""
    tipo_empresa: str = ""
    contato_nome: str = ""
    email: str = ""
    telefone: str = ""
    login_ecac: str = ""
    senha_ecac: str = ""
    login_sefaz: str = ""
    senha_sefaz: str = ""
    login_pref: str = ""
    senha_pref: str = ""
    login_dominio: str = ""
    senha_dominio: str = ""
    outros_acessos: str = ""
    ativo: bool = True

class ClienteUpdate(BaseModel):
    razao_social: str | None = None
    cnpj: str | None = None
    regime: str | None = None
    responsavel_fiscal: str | None = None
    rotinas_selecionadas: list | None = None
    drive_link: str | None = None
    codigo: str | None = None
    inscricao_estadual: str | None = None
    inscricao_municipal: str | None = None
    data_abertura: str | None = None
    tipo_empresa: str | None = None
    contato_nome: str | None = None
    email: str | None = None
    telefone: str | None = None
    login_ecac: str | None = None
    senha_ecac: str | None = None
    login_sefaz: str | None = None
    senha_sefaz: str | None = None
    login_pref: str | None = None
    senha_pref: str | None = None
    login_dominio: str | None = None
    senha_dominio: str | None = None
    outros_acessos: str | None = None
    ativo: bool | None = None
