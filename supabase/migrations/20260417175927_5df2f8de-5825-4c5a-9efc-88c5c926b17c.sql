CREATE OR REPLACE FUNCTION public.check_schedule_conflict(p_tecnico_id uuid, p_data date, p_hora_inicio time without time zone, p_hora_fim time without time zone, p_os_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conflict_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.ordens_servico os
    JOIN public.tickets t ON t.id = os.ticket_id
    WHERE os.tecnico_id = p_tecnico_id
      AND DATE(os.data_programada) = p_data
      AND os.hora_inicio IS NOT NULL
      AND os.hora_fim IS NOT NULL
      AND (p_os_id IS NULL OR os.id != p_os_id)
      -- Ignorar OS recusadas pelo técnico (não estão ocupando o spot)
      AND os.aceite_tecnico != 'recusado'
      -- Ignorar tickets cancelados ou concluídos (liberam o horário)
      AND t.status NOT IN ('cancelado', 'concluido')
      AND (
        (p_hora_inicio >= os.hora_inicio AND p_hora_inicio < os.hora_fim)
        OR
        (p_hora_fim > os.hora_inicio AND p_hora_fim <= os.hora_fim)
        OR
        (p_hora_inicio <= os.hora_inicio AND p_hora_fim >= os.hora_fim)
      )
  ) INTO v_conflict_exists;
  
  RETURN v_conflict_exists;
END;
$function$;