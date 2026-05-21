
-- 1) lote_id em insumo_saidas
ALTER TABLE public.insumo_saidas ADD COLUMN IF NOT EXISTS lote_id uuid;
UPDATE public.insumo_saidas SET lote_id = id WHERE lote_id IS NULL;
ALTER TABLE public.insumo_saidas ALTER COLUMN lote_id SET NOT NULL;
ALTER TABLE public.insumo_saidas ALTER COLUMN lote_id SET DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_insumo_saidas_lote ON public.insumo_saidas(lote_id);

-- 2) Tabela de entradas pendentes (sobras de não-retornáveis)
CREATE TABLE IF NOT EXISTS public.insumo_entradas_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saida_id uuid NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  observacoes text,
  evidencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente_aprovacao',
  registrada_por uuid NOT NULL,
  aprovado_por uuid,
  aprovado_at timestamptz,
  rejeitado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entradas_pendentes_saida ON public.insumo_entradas_pendentes(saida_id);
CREATE INDEX IF NOT EXISTS idx_entradas_pendentes_status ON public.insumo_entradas_pendentes(status);

ALTER TABLE public.insumo_entradas_pendentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entradas: view staff backoffice or owner" ON public.insumo_entradas_pendentes;
CREATE POLICY "Entradas: view staff backoffice or owner" ON public.insumo_entradas_pendentes
FOR SELECT USING (
  public.is_staff_or_backoffice(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.insumo_saidas s
    JOIN public.tecnicos t ON t.id = s.tecnico_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE s.id = insumo_entradas_pendentes.saida_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Entradas: insert owner or staff" ON public.insumo_entradas_pendentes;
CREATE POLICY "Entradas: insert owner or staff" ON public.insumo_entradas_pendentes
FOR INSERT WITH CHECK (
  public.is_staff_or_backoffice(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.insumo_saidas s
    JOIN public.tecnicos t ON t.id = s.tecnico_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE s.id = insumo_entradas_pendentes.saida_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Entradas: update staff backoffice" ON public.insumo_entradas_pendentes;
CREATE POLICY "Entradas: update staff backoffice" ON public.insumo_entradas_pendentes
FOR UPDATE USING (public.is_staff_or_backoffice(auth.uid()))
WITH CHECK (public.is_staff_or_backoffice(auth.uid()));

DROP TRIGGER IF EXISTS tr_entradas_pendentes_updated_at ON public.insumo_entradas_pendentes;
CREATE TRIGGER tr_entradas_pendentes_updated_at BEFORE UPDATE ON public.insumo_entradas_pendentes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: ao aprovar entrada pendente, soma ao estoque
CREATE OR REPLACE FUNCTION public.handle_entrada_pendente_aprovada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_saida public.insumo_saidas%ROWTYPE;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'aprovada')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'aprovada') THEN
    SELECT * INTO v_saida FROM public.insumo_saidas WHERE id = NEW.saida_id;
    IF v_saida.insumo_id IS NOT NULL THEN
      UPDATE public.insumos SET quantidade = quantidade + NEW.quantidade, updated_at = now()
      WHERE id = v_saida.insumo_id;
    ELSIF v_saida.kit_id IS NOT NULL THEN
      UPDATE public.insumos i SET quantidade = i.quantidade + (ki.quantidade * NEW.quantidade), updated_at = now()
      FROM public.kit_itens ki WHERE ki.kit_id = v_saida.kit_id AND i.id = ki.insumo_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_entrada_pendente_aprovada ON public.insumo_entradas_pendentes;
CREATE TRIGGER tr_entrada_pendente_aprovada
AFTER INSERT OR UPDATE ON public.insumo_entradas_pendentes
FOR EACH ROW EXECUTE FUNCTION public.handle_entrada_pendente_aprovada();

-- 3) RPC: registrar devolução propagando a todo o lote
CREATE OR REPLACE FUNCTION public.register_devolucao_lote(
  p_saida_id uuid,
  p_quantidade integer,
  p_observacoes text,
  p_evidencias jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lote uuid;
  v_user uuid;
  v_count integer := 0;
  v_rec record;
  v_qty integer;
  v_saldo integer;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT lote_id INTO v_lote FROM public.insumo_saidas WHERE id = p_saida_id;
  IF v_lote IS NULL THEN RAISE EXCEPTION 'Saída não encontrada'; END IF;

  IF NOT (public.is_staff_or_backoffice(v_user) OR EXISTS (
    SELECT 1 FROM public.insumo_saidas s
    JOIN public.tecnicos t ON t.id = s.tecnico_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE s.id = p_saida_id AND p.user_id = v_user
  )) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  FOR v_rec IN
    SELECT s.id, s.quantidade, s.quantidade_devolvida,
      COALESCE((SELECT SUM(d.quantidade) FROM public.insumo_devolucoes d
                WHERE d.saida_id = s.id AND d.status = 'pendente_aprovacao'), 0)::int AS pendente
    FROM public.insumo_saidas s
    WHERE s.lote_id = v_lote AND s.retornavel = true
  LOOP
    v_saldo := v_rec.quantidade - v_rec.quantidade_devolvida - v_rec.pendente;
    v_qty := LEAST(p_quantidade, v_saldo);
    IF v_qty > 0 THEN
      INSERT INTO public.insumo_devolucoes(saida_id, quantidade, registrada_por, observacoes, evidencias)
      VALUES (v_rec.id, v_qty, v_user, p_observacoes, COALESCE(p_evidencias, '[]'::jsonb));
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END $$;

-- 4) RPC: backoffice — lista devoluções (todas as saídas retornáveis ainda em jogo)
CREATE OR REPLACE FUNCTION public.get_backoffice_devolucoes()
RETURNS TABLE(
  saida_id uuid, lote_id uuid, ordem_servico_id uuid, numero_os text,
  insumo_nome text, kit_nome text, quantidade integer, quantidade_devolvida integer,
  retornavel boolean, saida_status text, tecnico_nome text, saida_created_at timestamptz,
  devolucoes jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.id, s.lote_id, s.ordem_servico_id, os.numero_os,
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
  JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  WHERE s.retornavel = true
    AND s.status NOT IN ('devolvida_total', 'rejeitada')
  ORDER BY s.created_at DESC;
$$;

-- 5) RPC: backoffice — entradas pendentes (sobras de não-retornáveis)
CREATE OR REPLACE FUNCTION public.get_backoffice_entradas_pendentes()
RETURNS TABLE(
  id uuid, saida_id uuid, ordem_servico_id uuid, numero_os text,
  insumo_nome text, kit_nome text, quantidade integer, status text,
  observacoes text, evidencias jsonb, rejeitado_motivo text,
  tecnico_nome text, created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.id, e.saida_id, s.ordem_servico_id, os.numero_os,
    i.nome, k.nome, e.quantidade, e.status, e.observacoes, e.evidencias, e.rejeitado_motivo,
    p.nome, e.created_at
  FROM public.insumo_entradas_pendentes e
  JOIN public.insumo_saidas s ON s.id = e.saida_id
  JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  ORDER BY e.created_at DESC;
$$;

-- 6) Atualiza get_minhas_devolucoes para incluir lote_id e entradas
DROP FUNCTION IF EXISTS public.get_minhas_devolucoes();
CREATE OR REPLACE FUNCTION public.get_minhas_devolucoes()
RETURNS TABLE(
  saida_id uuid, lote_id uuid, ordem_servico_id uuid, numero_os text,
  insumo_nome text, kit_nome text, quantidade integer, quantidade_devolvida integer,
  retornavel boolean, saida_status text, saida_created_at timestamptz,
  devolucoes jsonb, entradas jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.id, s.lote_id, s.ordem_servico_id, os.numero_os,
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
  JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  WHERE p.user_id = auth.uid()
  ORDER BY s.created_at DESC;
$$;
