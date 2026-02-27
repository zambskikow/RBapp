from src.core.database import supabase, supabase_admin

class ClienteCRUD:
    @staticmethod
    def get_all():
        return supabase.table("clientes").select("*").execute()

    @staticmethod
    def create(data: dict):
        # Limpar strings vazias para None para evitar erros de tipo no DB
        processed_data = {k: (v if v != "" else None) for k, v in data.items()}
        return supabase.table("clientes").insert(processed_data).execute()

    @staticmethod
    def update(cliente_id: int, data: dict):
        processed_data = {k: (v if v != "" else None) for k, v in data.items()}
        return supabase.table("clientes").update(processed_data).eq("id", cliente_id).execute()

    @staticmethod
    def delete(cliente_id: int):
        return supabase.table("clientes").delete().eq("id", cliente_id).execute()
