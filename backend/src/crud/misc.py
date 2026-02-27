from src.core.database import supabase, supabase_admin

class MiscCRUD:
    @staticmethod
    def get_setores():
        return supabase.table("setores").select("*").execute()

    @staticmethod
    def create_setor(data: dict):
        return supabase.table("setores").insert(data).execute()

    @staticmethod
    def delete_setor(nome: str):
        return supabase.table("setores").delete().eq("nome", nome).execute()

    @staticmethod
    def get_rotinas_base():
        return supabase.table("rotinas_base").select("*").execute()

    @staticmethod
    def create_rotina(data: dict):
        return supabase.table("rotinas_base").insert(data).execute()

    @staticmethod
    def update_rotina(rotina_id: int, data: dict):
        return supabase.table("rotinas_base").update(data).eq("id", rotina_id).execute()

    @staticmethod
    def delete_rotina_with_cascade(rotina_id: int):
        try:
            rotina_res = supabase.table("rotinas_base").select("nome").eq("id", rotina_id).execute()
            if rotina_res.data and len(rotina_res.data) > 0:
                rotina_nome = rotina_res.data[0]["nome"]
                supabase.table("execucoes").delete().eq("rotina", rotina_nome).execute()
        except Exception as e:
            print(f"Aviso ao deletar execucoes da rotina {rotina_id}: {e}")
        return supabase.table("rotinas_base").delete().eq("id", rotina_id).execute()

    @staticmethod
    def get_mensagens():
        return supabase.table("mensagens").select("*").execute()

    @staticmethod
    def create_mensagem(data: dict):
        return supabase.table("mensagens").insert(data).execute()

    @staticmethod
    def update_mensagem(msg_id: int, data: dict):
        return supabase.table("mensagens").update(data).eq("id", msg_id).execute()

    @staticmethod
    def get_logs():
        return supabase.table("logs").select("*").order("timestamp", desc=True).limit(500).execute()

    @staticmethod
    def create_log(data: dict):
        return supabase.table("logs").insert(data).execute()

    @staticmethod
    def get_cargos():
        return supabase.table("cargos_permissoes").select("*").execute()

    @staticmethod
    def create_cargo(data: dict):
        return supabase.table("cargos_permissoes").insert(data).execute()

    @staticmethod
    def update_cargo(cargo_id: int, data: dict):
        return supabase.table("cargos_permissoes").update(data).eq("id", cargo_id).execute()

    @staticmethod
    def delete_cargo(cargo_id: int):
        return supabase.table("cargos_permissoes").delete().eq("id", cargo_id).execute()

    @staticmethod
    def get_global_config():
        return supabase.table("global_config").select("*").execute()

    @staticmethod
    def update_global_config(config_id: int, data: dict):
        return supabase.table("global_config").update(data).eq("id", config_id).execute()
