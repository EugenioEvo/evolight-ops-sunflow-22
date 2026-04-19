-- 1) Drop the broken function (will recreate with new signature)
DROP FUNCTION IF EXISTS public.get_technician_workload(uuid, date, date);

-- 2) Create per-technician planned hours table for OS
CREATE TABLE IF NOT EXISTS public.horas_previstas_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tecnico_id uuid NOT NULL REFERENCES public.tecnicos(id) ON DELETE CASCADE,
  minutos_previstos integer NOT NULL DEFAULT 0 CHECK (minutos_previstos >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ordem_servico_id, tecnico_id)
);

CREATE INDEX IF NOT EXISTS idx_horas_previstas_os_tec ON public.horas_previstas_os(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_horas_previstas_os_os  ON public.horas_previstas_os(ordem_servico_id);

ALTER TABLE public.horas_previstas_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage horas previstas"
  ON public.horas_previstas_os FOR ALL
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Technicians view own horas previstas"
  ON public.horas_previstas_os FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tecnicos t
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE t.id = horas_previstas_os.tecnico_id
        AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_horas_previstas_os_updated
BEFORE UPDATE ON public.horas_previstas_os
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Backfill from existing duracao_estimada_min (single-technician OS)
INSERT INTO public.horas_previstas_os (ordem_servico_id, tecnico_id, minutos_previstos)
SELECT id, tecnico_id, COALESCE(duracao_estimada_min, 0)
FROM public.ordens_servico
WHERE tecnico_id IS NOT NULL
  AND duracao_estimada_min IS NOT NULL
  AND duracao_estimada_min > 0
ON CONFLICT (ordem_servico_id, tecnico_id) DO NOTHING;

-- 4) Remove deprecated field from tickets
ALTER TABLE public.tickets DROP COLUMN IF EXISTS tempo_estimado;

-- 5) Recreate workload function with Meta × Realizado
CREATE OR REPLACE FUNCTION public.get_technician_workload(
  p_tecnico_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  data date,
  total_os integer,
  total_minutos_previstos integer,
  total_minutos_realizados integer,
  os_pendentes integer,
  os_concluidas integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    DATE(os.data_programada) AS data,
    COUNT(*)::integer AS total_os,
    COALESCE(SUM(hp.minutos_previstos), 0)::integer AS total_minutos_previstos,
    COALESCE(SUM(
      CASE
        WHEN rme.status = 'aprovado'
         AND rme.start_time IS NOT NULL
         AND rme.end_time IS NOT NULL
         AND rme.start_time ~ '^[0-9]{2}:[0-9]{2}$'
         AND rme.end_time   ~ '^[0-9]{2}:[0-9]{2}$'
        THEN GREATEST(
          0,
          (EXTRACT(EPOCH FROM (rme.end_time::time - rme.start_time::time)) / 60)::integer
        )
        ELSE 0
      END
    ), 0)::integer AS total_minutos_realizados,
    COUNT(*) FILTER (
      WHERE t.status IN ('aberto','aguardando_aprovacao','aprovado','ordem_servico_gerada','em_execucao','aguardando_rme')
    )::integer AS os_pendentes,
    COUNT(*) FILTER (WHERE t.status = 'concluido')::integer AS os_concluidas
  FROM public.ordens_servico os
  JOIN public.tickets t ON t.id = os.ticket_id
  LEFT JOIN public.horas_previstas_os hp
         ON hp.ordem_servico_id = os.id AND hp.tecnico_id = os.tecnico_id
  LEFT JOIN public.rme_relatorios rme
         ON rme.ordem_servico_id = os.id
  WHERE os.tecnico_id = p_tecnico_id
    AND DATE(os.data_programada) BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(os.data_programada)
  ORDER BY DATE(os.data_programada);
END;
$function$;

-- 6) Helper: per-OS detail for "Top 5 estouros"
CREATE OR REPLACE FUNCTION public.get_technician_workload_os_detail(
  p_tecnico_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  ordem_servico_id uuid,
  numero_os text,
  data_programada timestamptz,
  cliente text,
  ticket_titulo text,
  minutos_previstos integer,
  minutos_realizados integer,
  ticket_status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    os.id,
    os.numero_os,
    os.data_programada,
    COALESCE(c.empresa, '—'),
    t.titulo,
    COALESCE(hp.minutos_previstos, 0)::integer,
    CASE
      WHEN rme.status = 'aprovado'
       AND rme.start_time IS NOT NULL
       AND rme.end_time IS NOT NULL
       AND rme.start_time ~ '^[0-9]{2}:[0-9]{2}$'
       AND rme.end_time   ~ '^[0-9]{2}:[0-9]{2}$'
      THEN GREATEST(0, (EXTRACT(EPOCH FROM (rme.end_time::time - rme.start_time::time)) / 60)::integer)
      ELSE 0
    END::integer,
    t.status::text
  FROM public.ordens_servico os
  JOIN public.tickets t ON t.id = os.ticket_id
  LEFT JOIN public.clientes c ON c.id = t.cliente_id
  LEFT JOIN public.horas_previstas_os hp
         ON hp.ordem_servico_id = os.id AND hp.tecnico_id = os.tecnico_id
  LEFT JOIN public.rme_relatorios rme
         ON rme.ordem_servico_id = os.id
  WHERE os.tecnico_id = p_tecnico_id
    AND DATE(os.data_programada) BETWEEN p_start_date AND p_end_date
  ORDER BY os.data_programada DESC;
END;
$function$;