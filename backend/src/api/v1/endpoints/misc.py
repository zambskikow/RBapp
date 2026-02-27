from fastapi import APIRouter, HTTPException, Depends
from src.models.misc import (
    SectorCreate, LogCreate, RotinaBaseCreate, RotinaBaseUpdate,
    MensagemCreate, MensagemUpdate, CargoCreate, CargoUpdate,
    GlobalConfigUpdate
)
from src.crud.misc import MiscCRUD
from src.api.v1.endpoints.auth import get_current_user_from_cookie

router = APIRouter(prefix="/api", tags=["Miscelânea"])
CurrentUser = Depends(get_current_user_from_cookie)

# Setores
@router.get("/setores")
def get_setores(user=CurrentUser):
    return MiscCRUD.get_setores().data

@router.post("/setores")
def create_setor(setor: SectorCreate, user=CurrentUser):
    return MiscCRUD.create_setor(setor.model_dump()).data

@router.delete("/setores/{nome}")
def delete_setor(nome: str, user=CurrentUser):
    return MiscCRUD.delete_setor(nome).data

# Rotinas Base
@router.get("/rotinas_base")
def get_rotinas_base(user=CurrentUser):
    return MiscCRUD.get_rotinas_base().data

@router.post("/rotinas_base")
def create_rotina(rotina: RotinaBaseCreate, user=CurrentUser):
    return MiscCRUD.create_rotina(rotina.model_dump()).data

@router.put("/rotinas_base/{rotina_id}")
def update_rotina(rotina_id: int, updates: RotinaBaseUpdate, user=CurrentUser):
    return MiscCRUD.update_rotina(rotina_id, updates.model_dump(exclude_unset=True)).data

@router.delete("/rotinas_base/{rotina_id}")
def delete_rotina(rotina_id: int, user=CurrentUser):
    return MiscCRUD.delete_rotina_with_cascade(rotina_id).data

# Mensagens
@router.get("/mensagens")
def get_mensagens(user=CurrentUser):
    return MiscCRUD.get_mensagens().data

@router.post("/mensagens")
def create_mensagem(msg: MensagemCreate, user=CurrentUser):
    return MiscCRUD.create_mensagem(msg.model_dump()).data

@router.put("/mensagens/{msg_id}")
def update_mensagem(msg_id: int, updates: MensagemUpdate, user=CurrentUser):
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        return {"detail": "Nenhum campo para atualizar"}
    return MiscCRUD.update_mensagem(msg_id, update_data).data

# Logs
@router.get("/logs")
def get_logs(user=CurrentUser):
    return MiscCRUD.get_logs().data

@router.post("/logs")
def create_log(log: LogCreate, user=CurrentUser):
    return MiscCRUD.create_log(log.model_dump()).data

# Cargos
@router.get("/cargos")
def get_cargos(user=CurrentUser):
    return MiscCRUD.get_cargos().data

@router.post("/cargos")
def create_cargo(cargo: CargoCreate, user=CurrentUser):
    return MiscCRUD.create_cargo(cargo.model_dump()).data

@router.put("/cargos/{cargo_id}")
def update_cargo(cargo_id: int, updates: CargoUpdate, user=CurrentUser):
    return MiscCRUD.update_cargo(cargo_id, updates.model_dump(exclude_unset=True)).data

@router.delete("/cargos/{cargo_id}")
def delete_cargo(cargo_id: int, user=CurrentUser):
    return MiscCRUD.delete_cargo(cargo_id).data

# Config Global
@router.get("/global_config")
def get_global_config(user=CurrentUser):
    return MiscCRUD.get_global_config().data

@router.put("/global_config/{id}")
def update_global_config(id: int, updates: GlobalConfigUpdate, user=CurrentUser):
    return MiscCRUD.update_global_config(id, updates.model_dump(exclude_unset=True)).data
