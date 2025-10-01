-- Remove the existing foreign key constraint from ordens_servico to tecnicos
ALTER TABLE public.ordens_servico 
DROP CONSTRAINT IF EXISTS ordens_servico_tecnico_id_fkey;

-- Add new foreign key constraint to prestadores
ALTER TABLE public.ordens_servico 
ADD CONSTRAINT ordens_servico_tecnico_id_fkey 
FOREIGN KEY (tecnico_id) 
REFERENCES public.prestadores(id)
ON DELETE SET NULL;

-- Create trigger to validate technician assignment on ordens_servico
DROP TRIGGER IF EXISTS validate_os_tecnico_assignment ON public.ordens_servico;
CREATE TRIGGER validate_os_tecnico_assignment
  BEFORE INSERT OR UPDATE OF tecnico_id ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tecnico_prestador();