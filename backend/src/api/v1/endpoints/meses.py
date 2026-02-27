from fastapi import APIRouter, HTTPException, Depends
from src.models.mes import MesCreate, MesUpdate
from src.crud.mes import MesCRUD
from src.api.v1.endpoints.auth import get_current_user_from_cookie

router = APIRouter(prefix="/api/meses", tags=["Meses"])
CurrentUser = Depends(get_current_user_from_cookie)

@router.get("")
def get_meses(user=CurrentUser):
    response = MesCRUD.get_all()
    return response.data

@router.post("")
def create_mes(mes: MesCreate, user=CurrentUser):
    response = MesCRUD.create(mes.model_dump())
    return response.data

@router.put("/{mes_id}")
def update_mes(mes_id: str, updates: MesUpdate, user=CurrentUser):
    response = MesCRUD.update(mes_id, updates.model_dump(exclude_unset=True))
    return response.data

@router.delete("/{mes_id}")
def delete_mes(mes_id: str, user=CurrentUser):
    try:
        response = MesCRUD.delete_with_cascade(mes_id)
        if not response.data:
            raise HTTPException(status_code=404, detail="Nenhum registro deletado.")
        return response.data
    except Exception as e:
        print(f"Erro ao deletar mês {mes_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
