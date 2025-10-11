-- =====================================================
-- FASE 1: COORDENADAS E GEOCODIFICAÇÃO
-- =====================================================

-- Adicionar coordenadas à tabela tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) NULL,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) NULL,
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP WITH TIME ZONE NULL;

-- Adicionar coordenadas à tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) NULL,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) NULL,
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP WITH TIME ZONE NULL;

-- Índices espaciais para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_tickets_coordinates ON public.tickets(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_coordinates ON public.clientes(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Índice para consultas de rotas por data
CREATE INDEX IF NOT EXISTS idx_ordens_servico_data_tecnico ON public.ordens_servico(data_programada, tecnico_id)
WHERE data_programada IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.tickets.latitude IS 'Latitude geocodificada do endereço de serviço';
COMMENT ON COLUMN public.tickets.longitude IS 'Longitude geocodificada do endereço de serviço';
COMMENT ON COLUMN public.tickets.geocoded_at IS 'Data/hora da última geocodificação (para cache)';
COMMENT ON COLUMN public.clientes.latitude IS 'Latitude do endereço principal do cliente';
COMMENT ON COLUMN public.clientes.longitude IS 'Longitude do endereço principal do cliente';

-- Trigger para marcar tickets para geocodificação
CREATE OR REPLACE FUNCTION public.trigger_geocode_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marcar para geocodificação se endereço foi alterado
  IF (TG_OP = 'INSERT' OR OLD.endereco_servico IS DISTINCT FROM NEW.endereco_servico) THEN
    IF NEW.endereco_servico IS NOT NULL AND NEW.endereco_servico != '' THEN
      NEW.geocoded_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_geocode_ticket ON public.tickets;
CREATE TRIGGER trigger_geocode_ticket
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_geocode_ticket();

-- =====================================================
-- FASE 3: SISTEMA DE AGENDAMENTO
-- =====================================================

-- Adicionar campos de horário às ordens de serviço
ALTER TABLE public.ordens_servico 
ADD COLUMN IF NOT EXISTS hora_inicio TIME NULL,
ADD COLUMN IF NOT EXISTS hora_fim TIME NULL,
ADD COLUMN IF NOT EXISTS duracao_estimada_min INTEGER NULL;

-- Índice composto para validação de conflitos
CREATE INDEX IF NOT EXISTS idx_ordens_servico_agendamento 
ON public.ordens_servico(tecnico_id, data_programada, hora_inicio, hora_fim)
WHERE data_programada IS NOT NULL;

COMMENT ON COLUMN public.ordens_servico.hora_inicio IS 'Horário de início programado para a OS';
COMMENT ON COLUMN public.ordens_servico.hora_fim IS 'Horário de término programado para a OS';
COMMENT ON COLUMN public.ordens_servico.duracao_estimada_min IS 'Duração estimada em minutos';

-- Função para verificar conflitos de agenda
CREATE OR REPLACE FUNCTION public.check_schedule_conflict(
  p_tecnico_id UUID,
  p_data DATE,
  p_hora_inicio TIME,
  p_hora_fim TIME,
  p_os_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.ordens_servico
    WHERE tecnico_id = p_tecnico_id
      AND DATE(data_programada) = p_data
      AND hora_inicio IS NOT NULL
      AND hora_fim IS NOT NULL
      AND (p_os_id IS NULL OR id != p_os_id)
      AND (
        -- Novo horário começa durante OS existente
        (p_hora_inicio >= hora_inicio AND p_hora_inicio < hora_fim)
        OR
        -- Novo horário termina durante OS existente
        (p_hora_fim > hora_inicio AND p_hora_fim <= hora_fim)
        OR
        -- Novo horário engloba OS existente
        (p_hora_inicio <= hora_inicio AND p_hora_fim >= hora_fim)
      )
  ) INTO v_conflict_exists;
  
  RETURN v_conflict_exists;
END;
$$;

-- Função para obter carga de trabalho do técnico
CREATE OR REPLACE FUNCTION public.get_technician_workload(
  p_tecnico_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  data DATE,
  total_os INTEGER,
  total_minutos INTEGER,
  os_pendentes INTEGER,
  os_concluidas INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(os.data_programada) as data,
    COUNT(*)::INTEGER as total_os,
    COALESCE(SUM(os.duracao_estimada_min), 0)::INTEGER as total_minutos,
    COUNT(*) FILTER (WHERE t.status IN ('aberto', 'em_analise', 'aprovado'))::INTEGER as os_pendentes,
    COUNT(*) FILTER (WHERE t.status = 'concluido')::INTEGER as os_concluidas
  FROM public.ordens_servico os
  JOIN public.tickets t ON t.id = os.ticket_id
  WHERE os.tecnico_id = p_tecnico_id
    AND DATE(os.data_programada) BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(os.data_programada)
  ORDER BY DATE(os.data_programada);
END;
$$;