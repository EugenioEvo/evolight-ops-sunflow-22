-- Criar tabela para rate limiting de geocodificação
CREATE TABLE IF NOT EXISTS public.geocoding_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para buscas eficientes por IP
CREATE INDEX IF NOT EXISTS idx_geocoding_rate_limits_ip ON public.geocoding_rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_geocoding_rate_limits_window ON public.geocoding_rate_limits(window_start);

-- Função para verificar e incrementar rate limit
CREATE OR REPLACE FUNCTION public.check_geocoding_rate_limit(p_ip TEXT, p_max_requests INTEGER DEFAULT 30, p_window_minutes INTEGER DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Limpar registros antigos (mais de 1 hora)
  DELETE FROM public.geocoding_rate_limits
  WHERE window_start < now() - interval '1 hour';
  
  -- Contar requisições na janela atual
  SELECT COALESCE(SUM(request_count), 0)
  INTO v_current_count
  FROM public.geocoding_rate_limits
  WHERE ip_address = p_ip
    AND window_start > v_window_start;
  
  -- Verificar se excedeu o limite
  IF v_current_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Incrementar contador
  INSERT INTO public.geocoding_rate_limits (ip_address, request_count, window_start)
  VALUES (p_ip, 1, now());
  
  RETURN TRUE;
END;
$$;

-- RLS desabilitado para esta tabela (apenas funções SECURITY DEFINER acessam)
ALTER TABLE public.geocoding_rate_limits ENABLE ROW LEVEL SECURITY;

-- Política para service role
CREATE POLICY "Service role can manage rate limits"
ON public.geocoding_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);