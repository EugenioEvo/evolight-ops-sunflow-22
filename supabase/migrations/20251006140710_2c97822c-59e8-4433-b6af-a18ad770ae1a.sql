-- Drop triggers first
DROP TRIGGER IF EXISTS validate_os_tecnico_assignment ON public.ordens_servico;
DROP TRIGGER IF EXISTS validate_tecnico_assignment ON public.tickets;

-- Drop the old validation function
DROP FUNCTION IF EXISTS public.validate_tecnico_prestador();

-- Create validation function for tickets (validates tecnico_responsavel_id)
CREATE OR REPLACE FUNCTION public.validate_ticket_tecnico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Create validation function for ordens_servico (validates tecnico_id)
CREATE OR REPLACE FUNCTION public.validate_os_tecnico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tecnico_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.prestadores 
      WHERE id = NEW.tecnico_id 
      AND categoria = 'tecnico'
    ) THEN
      RAISE EXCEPTION 'O prestador atribuído deve ter categoria "tecnico"';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate trigger for tickets
CREATE TRIGGER validate_tecnico_assignment
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.validate_ticket_tecnico();

-- Recreate trigger for ordens_servico
CREATE TRIGGER validate_os_tecnico_assignment
BEFORE INSERT OR UPDATE ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.validate_os_tecnico();