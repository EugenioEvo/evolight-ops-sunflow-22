-- Remove the existing foreign key constraint from tickets to tecnicos
ALTER TABLE public.tickets 
DROP CONSTRAINT IF EXISTS tickets_tecnico_responsavel_id_fkey;

-- Add new foreign key constraint to prestadores
ALTER TABLE public.tickets 
ADD CONSTRAINT tickets_tecnico_responsavel_id_fkey 
FOREIGN KEY (tecnico_responsavel_id) 
REFERENCES public.prestadores(id)
ON DELETE SET NULL;

-- Add check constraint to ensure only prestadores with categoria='tecnico' can be assigned
-- We'll use a function to validate this since CHECK constraints can't reference other tables
CREATE OR REPLACE FUNCTION public.validate_tecnico_prestador()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tecnico_responsavel_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.prestadores 
      WHERE id = NEW.tecnico_responsavel_id 
      AND categoria = 'tecnico'
    ) THEN
      RAISE EXCEPTION 'O prestador atribuído deve ter categoria "tecnico"';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to validate technician assignment
DROP TRIGGER IF EXISTS validate_tecnico_assignment ON public.tickets;
CREATE TRIGGER validate_tecnico_assignment
  BEFORE INSERT OR UPDATE OF tecnico_responsavel_id ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tecnico_prestador();