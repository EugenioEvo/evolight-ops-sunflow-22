-- =====================================================
-- FASE 2: GEOCODIFICAÇÃO AUTOMÁTICA COM CACHE
-- =====================================================

-- 1. Criar tabela de cache de geocodificação
CREATE TABLE IF NOT EXISTS public.geocoding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_normalized TEXT NOT NULL UNIQUE,
  original_address TEXT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  formatted_address TEXT,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_address 
  ON public.geocoding_cache(address_normalized);

-- Índice para limpeza de cache antigo
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_cached_at 
  ON public.geocoding_cache(cached_at DESC);

-- 2. Adicionar status de geocodificação nos tickets
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tickets' 
    AND column_name = 'geocoding_status'
  ) THEN
    ALTER TABLE public.tickets 
    ADD COLUMN geocoding_status TEXT DEFAULT 'pending' 
    CHECK (geocoding_status IN ('pending', 'processing', 'geocoded', 'failed'));
  END IF;
END $$;

-- 3. Atualizar trigger para chamar edge function automaticamente
CREATE OR REPLACE FUNCTION public.trigger_geocode_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
BEGIN
  -- Marcar para geocodificação se endereço foi alterado
  IF (TG_OP = 'INSERT' OR OLD.endereco_servico IS DISTINCT FROM NEW.endereco_servico) THEN
    IF NEW.endereco_servico IS NOT NULL AND NEW.endereco_servico != '' THEN
      NEW.geocoded_at := NULL;
      NEW.geocoding_status := 'pending';
      
      -- Chamar edge function de forma assíncrona usando pg_net (se disponível)
      -- Nota: Esta parte requer extensão pg_net instalada
      -- Por enquanto, apenas marcamos como pending e a UI/worker fará a geocodificação
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Função para limpar cache antigo (90+ dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_geocoding_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.geocoding_cache
  WHERE cached_at < now() - interval '90 days'
    AND hit_count < 2; -- Manter endereços frequentes
    
  -- Atualizar estatísticas
  ANALYZE public.geocoding_cache;
END;
$$;

-- 5. RLS Policies para geocoding_cache
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Admins e área técnica podem gerenciar cache
CREATE POLICY "Admins can manage geocoding cache"
  ON public.geocoding_cache
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'area_tecnica')
  );

-- Sistema pode inserir/atualizar cache
CREATE POLICY "System can manage geocoding cache"
  ON public.geocoding_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.geocoding_cache IS 'Cache global de endereços geocodificados para evitar chamadas duplicadas à API';
COMMENT ON COLUMN public.geocoding_cache.address_normalized IS 'Endereço normalizado (lowercase, trimmed) usado como chave única';
COMMENT ON COLUMN public.geocoding_cache.hit_count IS 'Número de vezes que este cache foi usado';
COMMENT ON COLUMN public.geocoding_cache.cached_at IS 'Data da última atualização do cache (usado para expiração)';

COMMENT ON COLUMN public.tickets.geocoding_status IS 'Status da geocodificação: pending, processing, geocoded, failed';