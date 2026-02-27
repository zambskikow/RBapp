-- Execute este script no SQL Editor do seu projeto Supabase para garantir que as colunas existam

ALTER TABLE execucoes
ADD COLUMN IF NOT EXISTS feito_em text,
ADD COLUMN IF NOT EXISTS baixado_por text;

-- Isso garantirá que o Supabase receba os dados de quem deu baixa na rotina e a data exata.
