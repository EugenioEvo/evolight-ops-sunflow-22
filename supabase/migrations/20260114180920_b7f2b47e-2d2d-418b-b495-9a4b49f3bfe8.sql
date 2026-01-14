-- Add priority field to clientes table
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 5;

-- Add comment for documentation
COMMENT ON COLUMN public.clientes.prioridade IS 'Prioridade do cliente (quanto menor o número, maior a prioridade)';