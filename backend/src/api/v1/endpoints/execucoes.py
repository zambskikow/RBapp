from fastapi import APIRouter, HTTPException, Depends
from src.models.execucao import ExecucaoCreate, ExecucaoUpdate
from src.crud.execucao import ExecucaoCRUD
from src.api.v1.endpoints.auth import get_current_user_from_cookie

router = APIRouter()
CurrentUser = Depends(get_current_user_from_cookie)

@router.get("/")
def get_execucoes(user=CurrentUser):
    response = ExecucaoCRUD.get_all()
    return response.data

@router.post("/")
def create_execucao(execucao: ExecucaoCreate, user=CurrentUser):
    response = ExecucaoCRUD.create(execucao.model_dump())
    return response.data

@router.put("/{exec_id}")
def update_execucao(exec_id: int, updates: ExecucaoUpdate, user=CurrentUser):
    response = ExecucaoCRUD.update(exec_id, updates.model_dump(exclude_unset=True))
    return response.data

@router.delete("/{exec_id}")
def delete_execucao(exec_id: int, user=CurrentUser):
    response = ExecucaoCRUD.delete(exec_id)
    return response.data
