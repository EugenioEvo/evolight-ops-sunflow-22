-- Adicionar coluna para rastrear erros de email
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS email_error_log JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ordens_servico.email_error_log IS 'Histórico de erros ao enviar emails (convites e lembretes)';

-- Adicionar índice para buscar OS com erros de email
CREATE INDEX IF NOT EXISTS idx_ordens_servico_email_errors 
ON public.ordens_servico ((jsonb_array_length(email_error_log)))
WHERE jsonb_array_length(email_error_log) > 0;