
-- 1. Nova função de cleanup (idempotente, chamada por cron)
CREATE OR REPLACE FUNCTION public.cleanup_geocoding_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.geocoding_rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$;

-- 2. Refatorar check_geocoding_rate_limit para ser VOLATILE mas sem DELETE
-- (mantém INSERT pois é necessário para contar requisições)
CREATE OR REPLACE FUNCTION public.check_geocoding_rate_limit(
  p_ip text,
  p_max_requests integer DEFAULT 30,
  p_window_minutes integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Contar requisições na janela atual (apenas registros recentes; antigos são limpos pelo cron)
  SELECT COALESCE(SUM(request_count), 0)
  INTO v_current_count
  FROM public.geocoding_rate_limits
  WHERE ip_address = p_ip
    AND window_start > v_window_start;

  IF v_current_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.geocoding_rate_limits (ip_address, request_count, window_start)
  VALUES (p_ip, 1, now());

  RETURN TRUE;
END;
$$;
