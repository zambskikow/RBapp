from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional

# Importar cliente Supabase desacoplado
from src.core.database import supabase
from src.core.security import verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    nome: str
    permissao: str
    cargo_id: Optional[int]
    ativo: bool
    email: Optional[str]

def get_current_user_from_cookie(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        # Remover 'Bearer ' se estiver presente (segurança extra)
        if token.startswith("Bearer "):
            token = token[7:]
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_id, payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Não autenticado ou token expirado")

@router.post("/login")
async def login(response: Response, form_data: LoginRequest):
    """
    Novo fluxo de Login focado em segurança:
    1. Busca usuário via Supabase pela chave 'nome' (futuramento ideal pelo email).
    2. Compara o hash (ou texto plano temporariamente se o script de update não rodou).
    3. Retorna um Cookie HttpOnly seguro e um JSON com dados do user.
    """
    try:
        # 0. Verificar se a conexão com o banco via Vercel falhou por falta de Keys
        if supabase is None:
            raise HTTPException(status_code=500, detail="SUPABASE_OFFLINE: Variáveis de Ambiente não configuradas na Vercel (.env).")

        # 1. Buscar usuário
        # Aqui usamos o Supabase anon (ele possui acesso restrito de listagem ou nós controlaremos o retorno via select)
        user_res = supabase.table("funcionarios").select("*").eq("nome", form_data.username).execute()
        
        if not user_res.data:
            raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")
            
        user = user_res.data[0]
        
        # 2. Verificar senha (Hash bcrypt)
        # Atenção: Temporariamente o security.py permite senhas iguais em plain text
        if not verify_password(form_data.password, user.get("senha", "")):
            raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

        if user.get("ativo", True) is False:
             raise HTTPException(status_code=403, detail="Acesso bloqueado. Usuário inativo.")

        # 3. Gerar Token e setar Cookie seguro
        token_data = {
            "sub": str(user["id"]),
            "nome": user["nome"],
            "permissao": user["permissao"],
            "cargo_id": user.get("cargo_id")
        }
        
        access_token = create_access_token(data=token_data)
        
        response.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            httponly=True,  # Proíbe acesso via JavaScript no Frontend
            secure=True,    # Apenas HTTPS
            samesite="lax",
            max_age=86400   # 1 dia
        )

        return {
             "message": "Login efetuado com sucesso",
             "user": {
                 "id": user["id"],
                 "nome": user["nome"],
                 "permissao": user["permissao"]
             }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logout")
async def logout(response: Response):
    """Remove o cookie de acesso."""
    response.delete_cookie("access_token")
    return {"message": "Deslogado com sucesso"}

@router.get("/me")
async def get_me(user_info: tuple = Depends(get_current_user_from_cookie)):
    """Verifica se o token ainda é válido ou recarrega informações essenciais da sessão"""
    user_id, payload = user_info
    
    # Podemos opcionalmente cruzar de volta com a Table "Cargos" para as telas_permitidas.
    user_res = supabase.table("funcionarios").select("id, nome, permissao, ativo, cargo_id").eq("id", user_id).execute()
    
    if not user_res.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    user = user_res.data[0]
    
    telas = ["operacional", "meu-desempenho", "mensagens"]
    
    if str(user.get("cargo_id")) != "None" and user.get("cargo_id"):
         cargos_res = supabase.table("cargos").select("telas_permitidas").eq("id", user["cargo_id"]).execute()
         if cargos_res.data:
              tt = cargos_res.data[0].get("telas_permitidas", [])
              if isinstance(tt, str):
                  import json
                  try: tt = json.loads(tt) 
                  except: tt = []
              telas = tt
    
    is_gerente = (user.get("permissao") or "").lower() == "gerente"
    is_admin = (user.get("nome") or "").lower() in ["manager", "admin"]
    
    if is_gerente or is_admin:
        todas = ['dashboard', 'operacional', 'clientes', 'equipe', 'rotinas', 'mensagens', 'marketing', 'settings', 'competencias', 'meu-desempenho']
        for t in todas:
            if t not in telas: telas.append(t)
            
    return {
        "id": user["id"],
        "nome": user["nome"],
        "permissao": user["permissao"],
        "telas_permitidas": telas
    }
