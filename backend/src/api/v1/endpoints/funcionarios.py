from fastapi import APIRouter, HTTPException, Depends
from src.models.funcionario import FuncionarioCreate, FuncionarioUpdate
from src.crud.funcionario import FuncionarioCRUD
from src.api.v1.endpoints.auth import get_current_user_from_cookie

router = APIRouter()
CurrentUser = Depends(get_current_user_from_cookie)

@router.get("/")
def get_funcionarios(user=CurrentUser):
    response = FuncionarioCRUD.get_all()
    return response.data

@router.post("/")
def create_funcionario(funcionario: FuncionarioCreate, user=CurrentUser):
    response = FuncionarioCRUD.create(funcionario.model_dump())
    return response.data

@router.put("/{funcionario_id}")
def update_funcionario(funcionario_id: int, updates: FuncionarioUpdate, user=CurrentUser):
    response = FuncionarioCRUD.update(funcionario_id, updates.model_dump(exclude_unset=True))
    return response.data

@router.delete("/{funcionario_id}")
def delete_funcionario(funcionario_id: int, user=CurrentUser):
    response = FuncionarioCRUD.delete_with_dependencies(funcionario_id)
    return response.data
