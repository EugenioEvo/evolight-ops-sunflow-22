ALTER TABLE public.rme_relatorios
ADD COLUMN IF NOT EXISTS data_fim_execucao timestamp with time zone;