from supabase import create_client

url = "https://khbdbuoryxqiprlkdcpz.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYmRidW9yeXhxaXBybGtkY3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODU4ODcsImV4cCI6MjA4NzI2MTg4N30.1rr3_-LVO6b2PR96lJl8d7vVfHseWwUeAQDY4tdJR-M"
supabase = create_client(url, key)

rotinas = [
    {
        "nome": "Entrada + ICMS",
        "setor": "Fiscal",
        "frequencia": "Mensal",
        "dia_prazo_padrao": 4,
        "checklist_padrao": ["Importar notas de compra (Executar rotina automática)", "Avaliar e classificar compras de fora do estado", "Gerar ICMS"]
    },
    {
        "nome": "ISS",
        "setor": "Fiscal",
        "frequencia": "Mensal",
        "dia_prazo_padrao": 8,
        "checklist_padrao": ["Avaliar notas de serviços tomados", "Gerar DAM"]
    },
    {
        "nome": "DMA",
        "setor": "Fiscal",
        "frequencia": "Mensal",
        "dia_prazo_padrao": 8,
        "checklist_padrao": ["Enviar declaração"]
    },
    {
        "nome": "Saída + Simples Nacional",
        "setor": "Fiscal",
        "frequencia": "Mensal",
        "dia_prazo_padrao": 14,
        "checklist_padrao": ["Importar notas de vendas (Executar rotina automática)", "Conferir se o valor faturado é igual ao valor importado no sistema", "Conferir se a sequência de notas está correta (relatório notas faltantes)", "Conferir se a alíquota e anexo estão corretos", "Conferir fator R", "Executar rotina de Geração do DAS"]
    },
    {
        "nome": "Estouro de Caixa e Pagamento de Impostos",
        "setor": "Fiscal",
        "frequencia": "Mensal",
        "dia_prazo_padrao": 26,
        "checklist_padrao": ["Emitir relatórios de análise de entrada e saída", "Emitir relatório de pagamento de impostos"]
    },
    {
        "nome": "DEFIS",
        "setor": "Fiscal",
        "frequencia": "Anual",
        "dia_prazo_padrao": 31, # Março
        "checklist_padrao": ["Conferência e envio da DEFIS"]
    },
    {
        "nome": "DASN SIMEI",
        "setor": "Fiscal",
        "frequencia": "Anual",
        "dia_prazo_padrao": 31, # Maio
        "checklist_padrao": ["Conferência e envio da DASN SIMEI"]
    },
    {
        "nome": "DMED",
        "setor": "Fiscal",
        "frequencia": "Anual",
        "dia_prazo_padrao": 28, # Fevereiro
        "checklist_padrao": ["Conferência e envio da DMED"]
    }
]

print("Inserindo rotinas base...")
for rotina in rotinas:
    try:
        supabase.table("rotinas_base").insert(rotina).execute()
        print(f"Sucesso: {rotina['nome']}")
    except Exception as e:
        print(f"Erro ao inserir {rotina['nome']}: {e}")

print("Concluído.")
