-- Schema for FiscalApp
-- Rodar este script no SQL Editor do Supabase

CREATE TABLE setores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE funcionarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    setor VARCHAR(100),
    permissao VARCHAR(50),
    senha VARCHAR(100)
);

CREATE TABLE rotinas_base (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    setor VARCHAR(100),
    frequencia VARCHAR(50),
    dia_prazo_padrao VARCHAR(50),
    checklist_padrao JSONB DEFAULT '[]'::jsonb,
    responsavel VARCHAR(100)
);

CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE,
    razao_social VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    regime VARCHAR(100),
    responsavel_fiscal VARCHAR(100),
    rotinas_selecionadas JSONB DEFAULT '[]'::jsonb,
    drive_link TEXT
);

CREATE TABLE meses (
    id VARCHAR(10) PRIMARY KEY, -- ex: '2026-02'
    mes VARCHAR(50),
    ativo BOOLEAN DEFAULT false,
    percent_concluido INT DEFAULT 0,
    atrasados INT DEFAULT 0,
    concluidos INT DEFAULT 0,
    total_execucoes INT DEFAULT 0,
    vencendo INT DEFAULT 0
);

CREATE TABLE execucoes (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id) ON DELETE CASCADE,
    rotina VARCHAR(255),
    competencia VARCHAR(20),
    dia_prazo DATE,
    drive_link TEXT,
    feito BOOLEAN DEFAULT false,
    feito_em DATE,
    responsavel VARCHAR(100),
    iniciado_em DATE,
    checklist_gerado BOOLEAN DEFAULT false,
    eh_pai BOOLEAN DEFAULT true,
    subitems JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE mensagens (
    id SERIAL PRIMARY KEY,
    remetente VARCHAR(100),
    destinatario VARCHAR(100),
    texto TEXT,
    lida BOOLEAN DEFAULT false,
    data TIMESTAMP DEFAULT NOW()
);

CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    user_name VARCHAR(100),
    permissao VARCHAR(50),
    action VARCHAR(100),
    details TEXT
);

CREATE TABLE config (
    id SERIAL PRIMARY KEY,
    auto_backup BOOLEAN DEFAULT false,
    last_backup_data TIMESTAMP,
    key VARCHAR(50) UNIQUE,
    value JSONB
);

-- Inserir dados iniciais (Opcional - Pode manter os usuários base)
INSERT INTO setores (nome) VALUES 
('Fiscal'), ('Contábil'), ('Departamento Pessoal'), ('Administrativo'), ('RH'), ('Legalização')
ON CONFLICT DO NOTHING;

INSERT INTO funcionarios (nome, setor, permissao, senha) VALUES
('Manager', 'Administrativo', 'Gerente', '123'),
('Dandara', 'Fiscal', 'Operacional', '123')
ON CONFLICT DO NOTHING;
