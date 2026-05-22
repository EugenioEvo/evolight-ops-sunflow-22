-- 1) is_staff inclui 'lider' (paridade com supervisao)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'engenharia'::app_role, 'supervisao'::app_role, 'lider'::app_role)
  )
$function$;

-- 2) insumo_saidas: OS opcional + flag uso_interno
ALTER TABLE public.insumo_saidas
  ALTER COLUMN ordem_servico_id DROP NOT NULL;

ALTER TABLE public.insumo_saidas
  ADD COLUMN IF NOT EXISTS uso_interno boolean NOT NULL DEFAULT false;

-- Garante coerência: ou tem OS, ou é uso_interno
ALTER TABLE public.insumo_saidas
  DROP CONSTRAINT IF EXISTS insumo_saidas_os_or_uso_interno;
ALTER TABLE public.insumo_saidas
  ADD CONSTRAINT insumo_saidas_os_or_uso_interno
  CHECK (uso_interno = true OR ordem_servico_id IS NOT NULL);

-- 3) Trigger devolução: skip bloqueio quando saída é uso interno (sem OS/RME)
CREATE OR REPLACE FUNCTION public.check_devolucao_rme_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rme_status text;
  v_saida public.insumo_saidas%ROWTYPE;
BEGIN
  SELECT * INTO v_saida FROM public.insumo_saidas WHERE id = NEW.saida_id;

  -- Saídas de uso interno não têm OS/RME para bloquear
  IF v_saida.uso_interno OR v_saida.ordem_servico_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.status INTO v_rme_status
  FROM public.ordens_servico os
  JOIN public.rme_relatorios r ON r.ordem_servico_id IN (
    SELECT os2.id FROM public.ordens_servico os2 WHERE os2.ticket_id = os.ticket_id
  )
  WHERE os.id = v_saida.ordem_servico_id
  ORDER BY r.updated_at DESC
  LIMIT 1;

  IF v_rme_status = 'aprovado' THEN
    RAISE EXCEPTION 'Não é possível registrar devolução: o RME do ticket já foi aprovado.';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Funções de listagem: LEFT JOIN ordens_servico para incluir uso interno
CREATE OR REPLACE FUNCTION public.get_minhas_devolucoes()
RETURNS TABLE(saida_id uuid, lote_id uuid, ordem_servico_id uuid, numero_os text, insumo_nome text, kit_nome text, quantidade integer, quantidade_devolvida integer, retornavel boolean, saida_status text, saida_created_at timestamp with time zone, devolucoes jsonb, entradas jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.id, s.lote_id, s.ordem_servico_id,
    COALESCE(os.numero_os, CASE WHEN s.uso_interno THEN 'USO INTERNO' END),
    i.nome, k.nome, s.quantidade, s.quantidade_devolvida, s.retornavel, s.status, s.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', d.id, 'quantidade', d.quantidade, 'status', d.status,
      'observacoes', d.observacoes, 'rejeitado_motivo', d.rejeitado_motivo,
      'evidencias', d.evidencias, 'created_at', d.created_at
    ) ORDER BY d.created_at DESC)
    FROM public.insumo_devolucoes d WHERE d.saida_id = s.id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', e.id, 'quantidade', e.quantidade, 'status', e.status,
      'observacoes', e.observacoes, 'rejeitado_motivo', e.rejeitado_motivo,
      'evidencias', e.evidencias, 'created_at', e.created_at
    ) ORDER BY e.created_at DESC)
    FROM public.insumo_entradas_pendentes e WHERE e.saida_id = s.id), '[]'::jsonb)
  FROM public.insumo_saidas s
  LEFT JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  WHERE p.user_id = auth.uid()
  ORDER BY s.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_backoffice_devolucoes()
RETURNS TABLE(saida_id uuid, lote_id uuid, ordem_servico_id uuid, numero_os text, insumo_nome text, kit_nome text, quantidade integer, quantidade_devolvida integer, retornavel boolean, saida_status text, tecnico_nome text, saida_created_at timestamp with time zone, devolucoes jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.id, s.lote_id, s.ordem_servico_id,
    COALESCE(os.numero_os, CASE WHEN s.uso_interno THEN 'USO INTERNO' END),
    i.nome, k.nome, s.quantidade, s.quantidade_devolvida, s.retornavel,
    s.status, p.nome, s.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', d.id, 'quantidade', d.quantidade, 'status', d.status,
      'observacoes', d.observacoes, 'rejeitado_motivo', d.rejeitado_motivo,
      'evidencias', d.evidencias, 'created_at', d.created_at,
      'registrada_por', d.registrada_por
    ) ORDER BY d.created_at DESC)
    FROM public.insumo_devolucoes d WHERE d.saida_id = s.id), '[]'::jsonb)
  FROM public.insumo_saidas s
  LEFT JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  WHERE s.retornavel = true
    AND s.status NOT IN ('devolvida_total', 'rejeitada')
  ORDER BY s.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_backoffice_entradas_pendentes()
RETURNS TABLE(id uuid, saida_id uuid, ordem_servico_id uuid, numero_os text, insumo_nome text, kit_nome text, quantidade integer, status text, observacoes text, evidencias jsonb, rejeitado_motivo text, tecnico_nome text, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    e.id, e.saida_id, s.ordem_servico_id,
    COALESCE(os.numero_os, CASE WHEN s.uso_interno THEN 'USO INTERNO' END),
    i.nome, k.nome, e.quantidade, e.status, e.observacoes, e.evidencias, e.rejeitado_motivo,
    p.nome, e.created_at
  FROM public.insumo_entradas_pendentes e
  JOIN public.insumo_saidas s ON s.id = e.saida_id
  LEFT JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  ORDER BY e.created_at DESC;
$function$;