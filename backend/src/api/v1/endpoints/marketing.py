from fastapi import APIRouter, HTTPException, Depends
from src.models.marketing import (
    MarketingPostCreate, MarketingPostUpdate,
    MarketingCampanhaCreate, MarketingCampanhaUpdate,
    MarketingEquipeCreate, MarketingEquipeUpdate,
    MarketingMetricaCreate
)
from src.crud.marketing import MarketingCRUD
from src.api.v1.endpoints.auth import get_current_user_from_cookie

router = APIRouter()
CurrentUser = Depends(get_current_user_from_cookie)

# Posts
@router.get("/posts")
def get_marketing_posts(user=CurrentUser):
    response = MarketingCRUD.get_posts()
    return response.data

@router.post("/posts")
def create_marketing_post(post: MarketingPostCreate, user=CurrentUser):
    response = MarketingCRUD.create_post(post.model_dump())
    return response.data

@router.put("/posts/{post_id}")
def update_marketing_post(post_id: int, updates: MarketingPostUpdate, user=CurrentUser):
    response = MarketingCRUD.update_post(post_id, updates.model_dump(exclude_unset=True))
    return response.data

@router.delete("/posts/{post_id}")
def delete_marketing_post(post_id: int, user=CurrentUser):
    response = MarketingCRUD.delete_post(post_id)
    return response.data

# Campanhas
@router.get("/campanhas")
def get_marketing_campanhas(user=CurrentUser):
    response = MarketingCRUD.get_campanhas()
    return response.data

@router.post("/campanhas")
def create_marketing_campanha(campanha: MarketingCampanhaCreate, user=CurrentUser):
    response = MarketingCRUD.create_campanha(campanha.model_dump())
    return response.data

@router.put("/campanhas/{campanha_id}")
def update_marketing_campanha(campanha_id: int, updates: MarketingCampanhaUpdate, user=CurrentUser):
    response = MarketingCRUD.update_campanha(campanha_id, updates.model_dump(exclude_unset=True))
    return response.data

@router.delete("/campanhas/{campanha_id}")
def delete_marketing_campanha(campanha_id: int, user=CurrentUser):
    response = MarketingCRUD.delete_campanha(campanha_id)
    return response.data

# Equipe
@router.get("/equipe")
def get_marketing_equipe(user=CurrentUser):
    response = MarketingCRUD.get_equipe()
    return response.data

@router.post("/equipe")
def create_marketing_equipe(equipe: MarketingEquipeCreate, user=CurrentUser):
    response = MarketingCRUD.create_equipe(equipe.model_dump())
    return response.data

@router.put("/equipe/{id}")
def update_marketing_equipe(id: int, updates: MarketingEquipeUpdate, user=CurrentUser):
    response = MarketingCRUD.update_equipe(id, updates.model_dump(exclude_unset=True))
    return response.data

@router.delete("/equipe/{id}")
def delete_marketing_equipe(id: int, user=CurrentUser):
    response = MarketingCRUD.delete_equipe(id)
    return response.data

# Métricas
@router.get("/metricas")
def get_marketing_metricas(user=CurrentUser):
    response = MarketingCRUD.get_metricas()
    return response.data

@router.post("/metricas")
def create_marketing_metrica(metrica: MarketingMetricaCreate, user=CurrentUser):
    response = MarketingCRUD.create_metrica(metrica.model_dump())
    return response.data
