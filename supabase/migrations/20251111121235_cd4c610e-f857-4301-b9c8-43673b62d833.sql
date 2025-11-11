-- Criar função RPC para obter todas as estatísticas do dashboard de uma vez
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tickets_abertos INTEGER;
  v_tickets_criticos INTEGER;
  v_tickets_hoje INTEGER;
  v_os_geradas INTEGER;
  v_em_execucao INTEGER;
  v_concluidos INTEGER;
  v_hoje TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Data de hoje (início do dia)
  v_hoje := date_trunc('day', now());
  
  -- Total de tickets abertos (não concluídos/cancelados)
  SELECT COUNT(*)
  INTO v_tickets_abertos
  FROM public.tickets
  WHERE status NOT IN ('concluido', 'cancelado');
  
  -- Tickets críticos (alta prioridade + crítica)
  SELECT COUNT(*)
  INTO v_tickets_criticos
  FROM public.tickets
  WHERE prioridade IN ('alta', 'critica')
    AND status NOT IN ('concluido', 'cancelado');
  
  -- Tickets finalizados hoje
  SELECT COUNT(*)
  INTO v_tickets_hoje
  FROM public.tickets
  WHERE status = 'concluido'
    AND data_conclusao >= v_hoje;
  
  -- OS geradas hoje
  SELECT COUNT(*)
  INTO v_os_geradas
  FROM public.ordens_servico
  WHERE created_at >= v_hoje;
  
  -- Em execução
  SELECT COUNT(*)
  INTO v_em_execucao
  FROM public.tickets
  WHERE status = 'em_execucao';
  
  -- Total concluídos
  SELECT COUNT(*)
  INTO v_concluidos
  FROM public.tickets
  WHERE status = 'concluido';
  
  -- Retornar todas as estatísticas em um único objeto JSON
  RETURN jsonb_build_object(
    'tickets_abertos', COALESCE(v_tickets_abertos, 0),
    'tickets_criticos', COALESCE(v_tickets_criticos, 0),
    'tickets_hoje', COALESCE(v_tickets_hoje, 0),
    'os_geradas', COALESCE(v_os_geradas, 0),
    'em_execucao', COALESCE(v_em_execucao, 0),
    'concluidos', COALESCE(v_concluidos, 0)
  );
END;
$function$;