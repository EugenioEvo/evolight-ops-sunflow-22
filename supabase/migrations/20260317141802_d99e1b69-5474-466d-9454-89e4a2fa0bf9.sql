
-- Add data_servico column to tickets table
ALTER TABLE public.tickets
ADD COLUMN data_servico date NULL;

-- Add comment
COMMENT ON COLUMN public.tickets.data_servico IS 'Data prevista para execução do serviço';
