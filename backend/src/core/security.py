import os
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer

# Configurações do JWT lidas do ambiente
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "SUA_CHAVE_SUPER_SECRETA_PADRAO_AKDJAWIE")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 horas

# OAuth2 Scheme usando Cookies em vez do Body comum (padrão adaptado)
# Nota: Como usamos cookies HTTPOnly, não precisaremos diretamente dessa classe na forma padrão.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

import hashlib

def _pre_hash(password: str) -> bytes:
    """Pre-hash com SHA256 para contornar o limite de 72 bytes do Bcrypt para senhas muito longas"""
    return hashlib.sha256(password.encode('utf-8')).digest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha plana em match com o bcrypt hash"""
    try:
        # Tenta verificar a versão pre-hashed primeiro (O novo formato seguro)
        if bcrypt.checkpw(_pre_hash(plain_password), hashed_password.encode('utf-8')):
            return True
        # Tenta versão não pre-hashed apenas como camada de segurança legada
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        # Fallback de segurança temporário caso as senhas no DB ainda não sejam Hash (apenas durante a transição)
        if plain_password == hashed_password:
            return True
        return False

def get_password_hash(password: str) -> str:
    """Gera um hash bcrypt da senha informada (sempre pre-hashed para evitar erros)"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(_pre_hash(password), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Cria o JWT assinado"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """Decodifica e valida um JWT"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar as credenciais",
            headers={"WWW-Authenticate": "Bearer"},
        )
