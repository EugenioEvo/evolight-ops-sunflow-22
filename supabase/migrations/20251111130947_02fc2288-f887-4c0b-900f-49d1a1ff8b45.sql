-- Adicionar campos necessários para o modelo de OS

ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS tipo_trabalho TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS inspetor_responsavel TEXT,
ADD COLUMN IF NOT EXISTS servico_solicitado TEXT,
ADD COLUMN IF NOT EXISTS equipe TEXT[];

-- Adicionar comentários
COMMENT ON COLUMN ordens_servico.tipo_trabalho IS 'Tipos: internet, eletrica, limpeza';
COMMENT ON COLUMN ordens_servico.inspetor_responsavel IS 'Nome do inspetor responsável';
COMMENT ON COLUMN ordens_servico.servico_solicitado IS 'Ex: MANUTENÇÃO, INSTALAÇÃO, etc';
COMMENT ON COLUMN ordens_servico.equipe IS 'Lista de nomes dos técnicos da equipe';