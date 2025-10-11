-- Add equipamento_id to rme_relatorios table
ALTER TABLE public.rme_relatorios 
ADD COLUMN equipamento_id uuid REFERENCES public.equipamentos(id) ON DELETE SET NULL;

-- Add qr_code_data to equipamentos table for storing QR code information
ALTER TABLE public.equipamentos 
ADD COLUMN qr_code_data jsonb;

-- Create index on numero_serie for faster QR code lookups
CREATE INDEX IF NOT EXISTS idx_equipamentos_numero_serie ON public.equipamentos(numero_serie);

-- Add comment for documentation
COMMENT ON COLUMN public.equipamentos.qr_code_data IS 'JSON data encoded in equipment QR code for quick scanning';
COMMENT ON COLUMN public.rme_relatorios.equipamento_id IS 'Reference to equipment serviced in this RME report';