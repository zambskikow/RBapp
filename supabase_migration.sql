-- Migration to add new detailed fields to the clientes table
-- Execute this in your Supabase SQL Editor

ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
ADD COLUMN IF NOT EXISTS data_abertura DATE,
ADD COLUMN IF NOT EXISTS tipo_empresa TEXT,
ADD COLUMN IF NOT EXISTS contato_nome TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS login_ecac TEXT,
ADD COLUMN IF NOT EXISTS senha_ecac TEXT,
ADD COLUMN IF NOT EXISTS login_sefaz TEXT,
ADD COLUMN IF NOT EXISTS senha_sefaz TEXT,
ADD COLUMN IF NOT EXISTS login_pref TEXT,
ADD COLUMN IF NOT EXISTS senha_pref TEXT,
ADD COLUMN IF NOT EXISTS login_dominio TEXT,
ADD COLUMN IF NOT EXISTS senha_dominio TEXT,
ADD COLUMN IF NOT EXISTS outros_acessos TEXT;

-- Comments for documentation inside Supabase
COMMENT ON COLUMN clientes.inscricao_estadual IS 'Inscrição Estadual do Cliente';
COMMENT ON COLUMN clientes.inscricao_municipal IS 'Inscrição Municipal do Cliente';
COMMENT ON COLUMN clientes.data_abertura IS 'Data de abertura da empresa';
COMMENT ON COLUMN clientes.tipo_empresa IS 'Tipo (LTDA, Individual, etc)';
COMMENT ON COLUMN clientes.contato_nome IS 'Nome da pessoa de contato principal';
COMMENT ON COLUMN clientes.email IS 'E-mail de contato do cliente';
COMMENT ON COLUMN clientes.telefone IS 'Telefone de contato do cliente';
COMMENT ON COLUMN clientes.login_ecac IS 'Login para portal E-CAC';
COMMENT ON COLUMN clientes.senha_ecac IS 'Senha para portal E-CAC';
COMMENT ON COLUMN clientes.login_sefaz IS 'Login para portal SEFAZ';
COMMENT ON COLUMN clientes.senha_sefaz IS 'Senha para portal SEFAZ';
COMMENT ON COLUMN clientes.login_pref IS 'Login para portal Prefeitura';
COMMENT ON COLUMN clientes.senha_pref IS 'Senha para portal Prefeitura';
COMMENT ON COLUMN clientes.login_dominio IS 'Login para sistema Domínio';
COMMENT ON COLUMN clientes.senha_dominio IS 'Senha para sistema Domínio';
COMMENT ON COLUMN clientes.outros_acessos IS 'Notas sobre outros acessos e senhas';
