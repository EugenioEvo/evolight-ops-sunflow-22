-- Habilitar Realtime para ordens_servico (REPLICA IDENTITY apenas)
ALTER TABLE public.ordens_servico REPLICA IDENTITY FULL;

-- Criar índice para melhorar performance de queries realtime
CREATE INDEX IF NOT EXISTS idx_ordens_servico_realtime 
ON public.ordens_servico(data_programada, tecnico_id) 
WHERE data_programada IS NOT NULL;