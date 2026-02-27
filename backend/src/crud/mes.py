from src.core.database import supabase, supabase_admin

class MesCRUD:
    @staticmethod
    def get_all():
        return supabase.table("meses").select("*").execute()

    @staticmethod
    def create(data: dict):
        return supabase.table("meses").insert(data).execute()

    @staticmethod
    def update(mes_id: str, data: dict):
        return supabase.table("meses").update(data).eq("id", mes_id).execute()

    @staticmethod
    def delete_with_cascade(mes_id: str):
        """
        Deleta um mês e todas as execuções vinculadas a ele.
        Usa o cliente admin se disponível para garantir permissão.
        """
        client = supabase_admin if supabase_admin else supabase
        
        # 1. Deletar execuções vinculadas
        try:
            client.table("execucoes").delete().eq("competencia", mes_id).execute()
        except Exception as e:
            print(f"Erro ao deletar execuções do mês {mes_id}: {e}")
            raise e

        # 2. Deletar o mês
        return client.table("meses").delete().eq("id", mes_id).execute()
