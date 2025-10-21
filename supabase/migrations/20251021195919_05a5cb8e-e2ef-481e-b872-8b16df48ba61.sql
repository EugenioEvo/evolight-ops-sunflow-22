-- Limpar e corrigir estrutura de técnicos

-- Passo 1: Tornar tecnico_id nullable
ALTER TABLE ordens_servico 
ALTER COLUMN tecnico_id DROP NOT NULL;

-- Passo 2: Remover tecnico_id de todas as OS temporariamente
UPDATE ordens_servico SET tecnico_id = NULL;

-- Passo 3: Remover constraint antiga
ALTER TABLE ordens_servico
DROP CONSTRAINT IF EXISTS ordens_servico_tecnico_id_fkey;

-- Passo 4: Adicionar constraint correta
ALTER TABLE ordens_servico
ADD CONSTRAINT ordens_servico_tecnico_id_fkey
FOREIGN KEY (tecnico_id)
REFERENCES tecnicos(id)
ON DELETE SET NULL;

-- Passo 5: Atribuir 2 OS ao técnico Genin Garcia
UPDATE ordens_servico 
SET tecnico_id = '5b61086d-6890-4035-9e26-a0ce24f07e7a'
WHERE numero_os IN ('OS000003', 'OS000004');