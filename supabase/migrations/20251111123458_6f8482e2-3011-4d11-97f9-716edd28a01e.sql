-- Adicionar campo de horário previsto de início nos tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS horario_previsto_inicio TIME NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.tickets.horario_previsto_inicio IS 'Horário previsto para início do atendimento do ticket';