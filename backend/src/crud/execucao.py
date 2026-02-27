from src.core.database import supabase

class ExecucaoCRUD:
    @staticmethod
    def get_all():
        return supabase.table("execucoes").select("*").execute()

    @staticmethod
    def create(data: dict):
        return supabase.table("execucoes").insert(data).execute()

    @staticmethod
    def update(exec_id: int, data: dict):
        return supabase.table("execucoes").update(data).eq("id", exec_id).execute()

    @staticmethod
    def delete(exec_id: int):
        return supabase.table("execucoes").delete().eq("id", exec_id).execute()
