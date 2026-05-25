CREATE OR REPLACE FUNCTION public.validate_ticket_tecnico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tecnico_responsavel_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.prestadores p
      LEFT JOIN public.tecnicos t ON t.prestador_id = p.id
      WHERE p.id = NEW.tecnico_responsavel_id
        AND (p.categoria = 'tecnico' OR t.id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'O prestador atribuído deve ser escalável como técnico (categoria "tecnico" ou provisionado em tecnicos)';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_os_tecnico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tecnico_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.prestadores p
      LEFT JOIN public.tecnicos t ON t.prestador_id = p.id
      WHERE p.id = NEW.tecnico_id
        AND (p.categoria = 'tecnico' OR t.id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'O prestador atribuído deve ser escalável como técnico (categoria "tecnico" ou provisionado em tecnicos)';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;