-- Criar tabela para fila de retry de emails
CREATE TABLE public.email_retry_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL, -- 'calendar_invite', 'reminder', etc
  payload JSONB NOT NULL, -- dados necessários para reenviar o email
  recipients TEXT[] NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'failed', 'success'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para buscar emails pendentes de retry
CREATE INDEX idx_email_retry_queue_next_retry ON public.email_retry_queue(next_retry_at, status) 
WHERE status = 'pending';

-- Index para buscar por tipo e status
CREATE INDEX idx_email_retry_queue_status ON public.email_retry_queue(status, email_type);

-- Trigger para updated_at
CREATE TRIGGER update_email_retry_queue_updated_at
BEFORE UPDATE ON public.email_retry_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.email_retry_queue ENABLE ROW LEVEL SECURITY;

-- Policies (somente funções do servidor podem acessar)
CREATE POLICY "Service role can manage email retry queue"
ON public.email_retry_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Função para calcular próximo retry com backoff exponencial
CREATE OR REPLACE FUNCTION calculate_next_retry(attempt INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
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
$$;