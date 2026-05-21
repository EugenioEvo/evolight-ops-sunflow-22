
-- 1) Anexos (fotos/vídeos) em devoluções
ALTER TABLE public.insumo_devolucoes
  ADD COLUMN IF NOT EXISTS evidencias jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Bucket privado para evidências de devolução
INSERT INTO storage.buckets (id, name, public)
VALUES ('devolucao-evidencias', 'devolucao-evidencias', false)
ON CONFLICT (id) DO NOTHING;

-- RLS bucket: técnico dono da saída ou staff/backoffice
CREATE POLICY "Devolucao evid: view staff/backoffice/owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'devolucao-evidencias' AND (
    public.is_staff_or_backoffice(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.insumo_saidas s
      JOIN public.tecnicos t ON t.id = s.tecnico_id
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE p.user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  )
);

CREATE POLICY "Devolucao evid: insert staff/backoffice/owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'devolucao-evidencias' AND (
    public.is_staff_or_backoffice(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.insumo_saidas s
      JOIN public.tecnicos t ON t.id = s.tecnico_id
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE p.user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  )
);

CREATE POLICY "Devolucao evid: delete staff/backoffice/owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'devolucao-evidencias' AND (
    public.is_staff_or_backoffice(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.insumo_saidas s
      JOIN public.tecnicos t ON t.id = s.tecnico_id
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE p.user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  )
);

-- 3) Histórico de compras
CREATE TABLE IF NOT EXISTS public.insumo_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric(12,2) NOT NULL CHECK (valor_unitario >= 0),
  fornecedor text,
  observacoes text,
  registrado_por uuid NOT NULL,
  preco_anterior numeric(12,2),
  qtd_anterior integer,
  preco_novo numeric(12,2),
  qtd_nova integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumo_compras_insumo ON public.insumo_compras(insumo_id);
CREATE INDEX IF NOT EXISTS idx_insumo_compras_created ON public.insumo_compras(created_at DESC);

ALTER TABLE public.insumo_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compras: view staff/backoffice/tecnico"
ON public.insumo_compras FOR SELECT
USING (public.is_staff(auth.uid()) OR public.is_backoffice(auth.uid()) OR public.has_role(auth.uid(), 'tecnico_campo'::app_role));

CREATE POLICY "Compras: insert staff/backoffice"
ON public.insumo_compras FOR INSERT
WITH CHECK (public.is_staff_or_backoffice(auth.uid()));

CREATE POLICY "Compras: update staff/backoffice"
ON public.insumo_compras FOR UPDATE
USING (public.is_staff_or_backoffice(auth.uid()))
WITH CHECK (public.is_staff_or_backoffice(auth.uid()));

-- 4) Trigger: ao registrar compra, recalcula média ponderada e atualiza insumo
CREATE OR REPLACE FUNCTION public.handle_insumo_compra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_qtd_atual integer;
  v_preco_atual numeric(12,2);
  v_qtd_nova integer;
  v_preco_novo numeric(12,2);
BEGIN
  SELECT COALESCE(quantidade,0), COALESCE(preco,0)
    INTO v_qtd_atual, v_preco_atual
    FROM public.insumos WHERE id = NEW.insumo_id FOR UPDATE;

  v_qtd_nova := v_qtd_atual + NEW.quantidade;
  IF v_qtd_nova > 0 THEN
    v_preco_novo := ROUND(((v_qtd_atual * v_preco_atual) + (NEW.quantidade * NEW.valor_unitario)) / v_qtd_nova, 2);
  ELSE
    v_preco_novo := NEW.valor_unitario;
  END IF;

  UPDATE public.insumos
     SET quantidade = v_qtd_nova,
         preco = v_preco_novo,
         fornecedor = COALESCE(NULLIF(NEW.fornecedor,''), fornecedor),
         updated_at = now()
   WHERE id = NEW.insumo_id;

  NEW.preco_anterior := v_preco_atual;
  NEW.qtd_anterior := v_qtd_atual;
  NEW.preco_novo := v_preco_novo;
  NEW.qtd_nova := v_qtd_nova;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_insumo_compra ON public.insumo_compras;
CREATE TRIGGER trg_insumo_compra
BEFORE INSERT ON public.insumo_compras
FOR EACH ROW EXECUTE FUNCTION public.handle_insumo_compra();

-- 5) Notificar BackOffice somente para devoluções RETORNÁVEIS pendentes
CREATE OR REPLACE FUNCTION public.notify_backoffice_rme_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pendencias integer;
  v_user record;
  v_numero_os text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'aprovado' THEN
    SELECT count(*) INTO v_pendencias
    FROM public.get_rme_pendencias_insumos(NEW.id) p
    WHERE p.retornavel = true
      AND p.status IN ('pendente_aprovacao','devolvida_parcial','aprovada');

    IF v_pendencias > 0 THEN
      SELECT numero_os INTO v_numero_os FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;
      FOR v_user IN SELECT user_id FROM public.user_roles WHERE role = 'backoffice'::app_role LOOP
        INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
        VALUES (v_user.user_id, 'insumos_pendencia',
                'RME aprovado com pendências de insumos retornáveis',
                'O RME da OS ' || COALESCE(v_numero_os, '') || ' foi aprovado e possui ' || v_pendencias || ' saída(s) retornável(is) pendente(s) de devolução/validação.',
                '/backoffice/insumos');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Nova RPC: lista de saídas com saldo para o técnico logado (para "Minhas Devoluções")
CREATE OR REPLACE FUNCTION public.get_minhas_devolucoes()
RETURNS TABLE (
  saida_id uuid,
  ordem_servico_id uuid,
  numero_os text,
  insumo_nome text,
  kit_nome text,
  quantidade integer,
  quantidade_devolvida integer,
  retornavel boolean,
  saida_status text,
  saida_created_at timestamptz,
  devolucoes jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    s.ordem_servico_id,
    os.numero_os,
    i.nome,
    k.nome,
    s.quantidade,
    s.quantidade_devolvida,
    s.retornavel,
    s.status,
    s.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'quantidade', d.quantidade,
        'status', d.status,
        'observacoes', d.observacoes,
        'rejeitado_motivo', d.rejeitado_motivo,
        'evidencias', d.evidencias,
        'created_at', d.created_at
      ) ORDER BY d.created_at DESC)
      FROM public.insumo_devolucoes d
      WHERE d.saida_id = s.id
    ), '[]'::jsonb)
  FROM public.insumo_saidas s
  JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  WHERE p.user_id = auth.uid()
  ORDER BY s.created_at DESC;
$$;

-- 7) Remover restrição que impedia devolução com RME aprovado — agora permitimos
DROP TRIGGER IF EXISTS check_devolucao_rme_status_trg ON public.insumo_devolucoes;
