from src.core.database import supabase

class MarketingCRUD:
    # Posts
    @staticmethod
    def get_posts():
        return supabase.table("marketing_posts").select("*").execute()
    
    @staticmethod
    def create_post(data: dict):
        return supabase.table("marketing_posts").insert(data).execute()
    
    @staticmethod
    def update_post(post_id: int, data: dict):
        return supabase.table("marketing_posts").update(data).eq("id", post_id).execute()
    
    @staticmethod
    def delete_post(post_id: int):
        return supabase.table("marketing_posts").delete().eq("id", post_id).execute()

    # Campanhas
    @staticmethod
    def get_campanhas():
        return supabase.table("marketing_campanhas").select("*").execute()
    
    @staticmethod
    def create_campanha(data: dict):
        return supabase.table("marketing_campanhas").insert(data).execute()
    
    @staticmethod
    def update_campanha(campanha_id: int, data: dict):
        return supabase.table("marketing_campanhas").update(data).eq("id", campanha_id).execute()
    
    @staticmethod
    def delete_campanha(campanha_id: int):
        return supabase.table("marketing_campanhas").delete().eq("id", campanha_id).execute()

    # Equipe
    @staticmethod
    def get_equipe():
        return supabase.table("marketing_equipe").select("*").execute()
    
    @staticmethod
    def create_equipe(data: dict):
        return supabase.table("marketing_equipe").insert(data).execute()
    
    @staticmethod
    def update_equipe(id: int, data: dict):
        return supabase.table("marketing_equipe").update(data).eq("id", id).execute()
    
    @staticmethod
    def delete_equipe(id: int):
        return supabase.table("marketing_equipe").delete().eq("id", id).execute()

    # Métricas
    @staticmethod
    def get_metricas():
        return supabase.table("marketing_metricas").select("*").order("data_referencia", desc=True).limit(100).execute()
    
    @staticmethod
    def create_metrica(data: dict):
        return supabase.table("marketing_metricas").insert(data).execute()
