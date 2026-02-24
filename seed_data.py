import os
from supabase import create_client, Client

url: str = os.getenv("SUPABASE_URL", "https://fanxxrrhtfcxomeklepk.supabase.co")
key: str = os.getenv("SUPABASE_KEY", "sb_publishable_oQZ8fGdQ95t8LVvJoMDavQ_O0ekKMzI")
supabase: Client = create_client(url, key)

def seed_database():
    print("Iniciando migração de dados...")

    # Setores
    setores = [{"nome": "Fiscal"}, {"nome": "Contábil"}, {"nome": "Departamento Pessoal"}, {"nome": "Administrativo"}, {"nome": "RH"}, {"nome": "Legalização"}]
    for s in setores:
        try:
            supabase.table("setores").insert(s).execute()
        except Exception as e:
            print(f"Erro setores: {e}")

    # Funcionários
    funcionarios = [
        {"nome": "Manager", "setor": "Administrativo", "permissao": "Gerente", "senha": "123"},
        {"nome": "Dandara", "setor": "Fiscal", "permissao": "Operacional", "senha": "123"}
    ]
    for f in funcionarios:
        try:
            supabase.table("funcionarios").insert(f).execute()
        except Exception as e:
            print(f"Erro func: {e}")

    # Rotinas Base
    rotinas_base = [
        {"nome": "Entrada + ICMS", "setor": "Fiscal", "frequencia": "Mensal", "dia_prazo_padrao": "4", "checklist_padrao": ["Importar XML de Entrada", "Analisar retenções", "Apurar ICMS"]},
        {"nome": "EFD ICMS/IPI", "setor": "Fiscal", "frequencia": "Mensal", "dia_prazo_padrao": "8", "checklist_padrao": ["Gerar arquivo Sped", "Validar no PGE", "Transmitir"]},
        {"nome": "DAS/Simples", "setor": "Fiscal", "frequencia": "Mensal", "dia_prazo_padrao": "10", "checklist_padrao": ["Calcular Faturamento", "Gerar DAS", "Enviar ao cliente"]},
        {"nome": "ISS", "setor": "Fiscal", "frequencia": "Mensal", "dia_prazo_padrao": "10", "checklist_padrao": ["Importar Notas de Serviço", "Apurar ISS", "Gerar Guia"]},
        {"nome": "GIA", "setor": "Fiscal", "frequencia": "Mensal", "dia_prazo_padrao": "15", "checklist_padrao": ["Importar dados para GIA", "Validar inconsistências", "Transmitir GIA"]},
        {"nome": "DCTF Web", "setor": "Departamento Pessoal", "frequencia": "Mensal", "dia_prazo_padrao": "15", "checklist_padrao": ["Verificar e-Social", "Verificar EFD-Reinf", "Transmitir DCTF Web"]},
        {"nome": "Balanço Patrimonial", "setor": "Contábil", "frequencia": "Anual", "dia_prazo_padrao": "30/04", "checklist_padrao": ["Conciliação bancária anual", "Ajustes de depreciação", "Fechar DRE", "Assinar balanço"]},
        {"nome": "Alteração Contratual / Eventual", "setor": "Legalização", "frequencia": "Eventual", "dia_prazo_padrao": "5", "checklist_padrao": ["Coletar assinaturas", "Enviar para junta comercial", "Emitir novo CNPJ"]}
    ]
    for rb in rotinas_base:
        try:
            supabase.table("rotinas_base").insert(rb).execute()
        except Exception as e:
            print(f"Erro rotina base: {e}")

    # Clientes
    clientes = [
        {"codigo": "C001", "razao_social": "Empresa Alfa Ltda", "cnpj": "12.345.678/0001-90", "regime": "Simples Nacional", "responsavel_fiscal": "Manager", "rotinas_selecionadas": [1, 3], "drive_link": ""},
        {"codigo": "C002", "razao_social": "Oficina do João", "cnpj": "98.765.432/0001-10", "regime": "Simples Nacional", "responsavel_fiscal": "Dandara", "rotinas_selecionadas": [3, 4], "drive_link": ""},
        {"codigo": "C003", "razao_social": "Indústria Beta", "cnpj": "11.222.333/0001-44", "regime": "Lucro Presumido", "responsavel_fiscal": "Dandara", "rotinas_selecionadas": [1, 2, 5, 6], "drive_link": ""},
        {"codigo": "C004", "razao_social": "Consultoria XYZ", "cnpj": "55.666.777/0001-88", "regime": "Lucro Presumido", "responsavel_fiscal": "Manager", "rotinas_selecionadas": [4, 6], "drive_link": ""},
        {"codigo": "C005", "razao_social": "Mercadinho da Esquina", "cnpj": "99.888.777/0001-22", "regime": "MEI", "responsavel_fiscal": "Dandara", "rotinas_selecionadas": [4], "drive_link": ""}
    ]
    for c in clientes:
        try:
            supabase.table("clientes").insert(c).execute()
        except Exception as e:
            print(f"Erro cliente: {e}")
            
    # Meses do sistema
    meses = [
        {"id": "2026-02", "mes": "Fevereiro 2026", "ativo": True}
    ]
    for m in meses:
        try:
             supabase.table("meses").insert(m).execute()
        except Exception as e:
            print(f"Erro meses: {e}")

    print("Migração concluída!")

if __name__ == "__main__":
    seed_database()
