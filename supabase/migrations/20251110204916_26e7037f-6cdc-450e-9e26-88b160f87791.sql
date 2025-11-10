-- Fase 1: Correções Críticas

-- 1. UNIFICAR SISTEMA DE TÉCNICOS
-- Criar tabela para tokens de confirmação de presença seguros
CREATE TABLE IF NOT EXISTS public.presence_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token)
);

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_presence_tokens_os ON public.presence_confirmation_tokens(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_presence_tokens_token ON public.presence_confirmation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_presence_tokens_expires ON public.presence_confirmation_tokens(expires_at);

-- RLS para tokens
ALTER TABLE public.presence_confirmation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tokens são públicos para validação"
ON public.presence_confirmation_tokens
FOR SELECT
USING (true);

-- 2. ADICIONAR ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente ON public.tickets(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_os_tecnico_data ON public.ordens_servico(tecnico_id, data_programada);
CREATE INDEX IF NOT EXISTS idx_os_ticket ON public.ordens_servico(ticket_id);
CREATE INDEX IF NOT EXISTS idx_rme_status ON public.rme_relatorios(status_aprovacao);
CREATE INDEX IF NOT EXISTS idx_rme_tecnico ON public.rme_relatorios(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_cliente ON public.equipamentos(cliente_id);

-- 3. ADICIONAR COLUNA PARA TRACKING DE STATUS
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS can_create_rme BOOLEAN GENERATED ALWAYS AS (status = 'em_execucao') STORED;

-- 4. FUNÇÃO PARA GERAR TOKEN SEGURO DE CONFIRMAÇÃO
CREATE OR REPLACE FUNCTION public.generate_presence_token(p_os_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
BEGIN
  -- Invalidar tokens anteriores
  UPDATE public.presence_confirmation_tokens
  SET used_at = now()
  WHERE ordem_servico_id = p_os_id
    AND used_at IS NULL;
  
  -- Criar novo token
  INSERT INTO public.presence_confirmation_tokens (ordem_servico_id, token)
  VALUES (p_os_id, gen_random_uuid())
  RETURNING token INTO v_token;
  
  RETURN v_token;
END;
$$;

-- 5. FUNÇÃO PARA VALIDAR TOKEN DE CONFIRMAÇÃO
CREATE OR REPLACE FUNCTION public.validate_presence_token(p_token UUID, p_os_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.presence_confirmation_tokens
    WHERE token = p_token
      AND ordem_servico_id = p_os_id
      AND expires_at > now()
      AND used_at IS NULL
  ) INTO v_valid;
  
  RETURN v_valid;
END;
$$;

-- 6. FUNÇÃO PARA MARCAR TOKEN COMO USADO
CREATE OR REPLACE FUNCTION public.mark_token_used(p_token UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.presence_confirmation_tokens
  SET used_at = now()
  WHERE token = p_token;
END;
$$;

-- 7. TRIGGER PARA LIMPAR TOKENS EXPIRADOS (executado diariamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.presence_confirmation_tokens
  WHERE expires_at < now() - interval '7 days';
END;
$$;

-- 8. ADICIONAR RATE LIMITING PARA CONFIRMAÇÃO DE PRESENÇA
CREATE TABLE IF NOT EXISTS public.presence_confirmation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  ordem_servico_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presence_attempts_ip_time 
ON public.presence_confirmation_attempts(ip_address, attempted_at);

ALTER TABLE public.presence_confirmation_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attempts são públicos"
ON public.presence_confirmation_attempts
FOR ALL
USING (true)
WITH CHECK (true);

-- Função para verificar rate limit
CREATE OR REPLACE FUNCTION public.check_presence_rate_limit(p_ip TEXT, p_os_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_count INTEGER;
BEGIN
  -- Limpar tentativas antigas (mais de 1 hora)
  DELETE FROM public.presence_confirmation_attempts
  WHERE attempted_at < now() - interval '1 hour';
  
  -- Contar tentativas recentes (últimos 15 minutos)
  SELECT COUNT(*)
  INTO v_attempt_count
  FROM public.presence_confirmation_attempts
  WHERE ip_address = p_ip
    AND ordem_servico_id = p_os_id
    AND attempted_at > now() - interval '15 minutes';
  
  -- Máximo 5 tentativas em 15 minutos
  RETURN v_attempt_count < 5;
END;
$$;

-- Registrar tentativa
CREATE OR REPLACE FUNCTION public.log_presence_attempt(p_ip TEXT, p_os_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.presence_confirmation_attempts (ip_address, ordem_servico_id)
  VALUES (p_ip, p_os_id);
END;
$$;