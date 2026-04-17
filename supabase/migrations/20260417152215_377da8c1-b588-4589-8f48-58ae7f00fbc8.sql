-- Add tecnico_responsavel_id to ordens_servico
-- This column tracks the responsible technician for the service (independent of the OS-specific tecnico_id)
-- All OS linked to the same ticket should carry the same tecnico_responsavel_id

ALTER TABLE public.ordens_servico 
ADD COLUMN tecnico_responsavel_id uuid;

CREATE INDEX idx_os_tecnico_responsavel 
ON public.ordens_servico(tecnico_responsavel_id);

COMMENT ON COLUMN public.ordens_servico.tecnico_responsavel_id IS 
'Técnico responsável pelo serviço (compartilhado entre todas as OS do mesmo ticket). Promovido automaticamente quando o responsável atual recusa e outro técnico aceita.';