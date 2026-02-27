from fastapi import APIRouter, HTTPException, Depends
from src.models.cliente import ClienteCreate, ClienteUpdate
from src.crud.cliente import ClienteCRUD
from src.api.v1.endpoints.auth import get_current_user_from_cookie

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])
CurrentUser = Depends(get_current_user_from_cookie)

@router.get("")
def get_clientes(user=CurrentUser):
    response = ClienteCRUD.get_all()
    return response.data

@router.post("")
def create_cliente(cliente: ClienteCreate, user=CurrentUser):
    try:
        response = ClienteCRUD.create(cliente.model_dump())
        return response.data
    except Exception as e:
        print(f"Erro ao criar cliente: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{cliente_id}")
def update_cliente(cliente_id: int, updates: ClienteUpdate, user=CurrentUser):
    try:
        response = ClienteCRUD.update(cliente_id, updates.model_dump(exclude_unset=True))
        return response.data
    except Exception as e:
        print(f"Erro ao atualizar cliente {cliente_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{cliente_id}")
def delete_cliente(cliente_id: int, user=CurrentUser):
    response = ClienteCRUD.delete(cliente_id)
    return response.data
