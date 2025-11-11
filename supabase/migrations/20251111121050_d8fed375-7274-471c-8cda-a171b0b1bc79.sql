-- Adicionar SET search_path em funções que ainda não possuem

-- Atualizar função calculate_next_retry
CREATE OR REPLACE FUNCTION public.calculate_next_retry(attempt integer)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delay_minutes INTEGER;
BEGIN
  -- Backoff exponencial: 1min, 5min, 15min, 1h, 4h
  delay_minutes := CASE attempt
    WHEN 0 THEN 1
    WHEN 1 THEN 5
    WHEN 2 THEN 15
    WHEN 3 THEN 60
    ELSE 240
  END;
  
  RETURN now() + (delay_minutes || ' minutes')::INTERVAL;
END;
$function$;

-- Atualizar função trigger_status_historico
CREATE OR REPLACE FUNCTION public.trigger_status_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.status_historico (
      ticket_id,
      status_anterior,
      status_novo,
      alterado_por
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(auth.uid(), NEW.created_by)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualizar função trigger_gerar_numero_ticket
CREATE OR REPLACE FUNCTION public.trigger_gerar_numero_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero_ticket IS NULL OR NEW.numero_ticket = '' THEN
    NEW.numero_ticket := public.gerar_numero_ticket();
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualizar função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;