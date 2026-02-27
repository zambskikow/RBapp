from pydantic import BaseModel

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
