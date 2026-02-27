from src.core.database import supabase

class FuncionarioCRUD:
    @staticmethod
    def get_all():
        return supabase.table("funcionarios").select("*").execute()

    @staticmethod
    def create(data: dict):
        return supabase.table("funcionarios").insert(data).execute()

    @staticmethod
    def update(funcionario_id: int, data: dict):
        return supabase.table("funcionarios").update(data).eq("id", funcionario_id).execute()

    @staticmethod
    def delete_with_dependencies(funcionario_id: int):
        """Deleta funcionário e remove referências em marketing_equipe"""
        try:
            supabase.table("marketing_equipe").delete().eq("funcionario_id", funcionario_id).execute()
        except Exception as e:
            print(f"Aviso ao deletar dependências de marketing do funcionário {funcionario_id}: {e}")
            
        return supabase.table("funcionarios").delete().eq("id", funcionario_id).execute()
