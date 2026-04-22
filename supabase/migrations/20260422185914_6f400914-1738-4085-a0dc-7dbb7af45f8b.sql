-- =========================================================
-- 1. Helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_backoffice(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'backoffice'::app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_backoffice(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff(_user_id) OR public.is_backoffice(_user_id);
$$;

-- =========================================================
-- 2. Insumos: flag retornavel + atualizar RLS
-- =========================================================
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS retornavel boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Staff can view inventory" ON public.insumos;
DROP POLICY IF EXISTS "Staff can insert inventory" ON public.insumos;
DROP POLICY IF EXISTS "Staff can update inventory" ON public.insumos;
DROP POLICY IF EXISTS "Staff can delete inventory" ON public.insumos;

CREATE POLICY "Staff backoffice and tech view inventory"
ON public.insumos FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR public.is_backoffice(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico_campo'::app_role)
);

CREATE POLICY "Staff and backoffice insert inventory"
ON public.insumos FOR INSERT
WITH CHECK (public.is_staff_or_backoffice(auth.uid()));

CREATE POLICY "Staff and backoffice update inventory"
ON public.insumos FOR UPDATE
USING (public.is_staff_or_backoffice(auth.uid()))
WITH CHECK (public.is_staff_or_backoffice(auth.uid()));

CREATE POLICY "Staff and backoffice delete inventory"
ON public.insumos FOR DELETE
USING (public.is_staff_or_backoffice(auth.uid()));

-- =========================================================
-- 3. Tabela kits
-- =========================================================
CREATE TABLE IF NOT EXISTS public.kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_id, insumo_id)
);

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff backoffice tech view kits"
ON public.kits FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR public.is_backoffice(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico_campo'::app_role)
);

CREATE POLICY "Admin and backoffice manage kits"
ON public.kits FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_backoffice(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_backoffice(auth.uid()));

CREATE POLICY "Staff backoffice tech view kit_itens"
ON public.kit_itens FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR public.is_backoffice(auth.uid())
  OR public.has_role(auth.uid(), 'tecnico_campo'::app_role)
);

CREATE POLICY "Admin and backoffice manage kit_itens"
ON public.kit_itens FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_backoffice(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_backoffice(auth.uid()));

CREATE TRIGGER trg_kits_updated_at
BEFORE UPDATE ON public.kits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. Tabela insumo_saidas
-- =========================================================
CREATE TABLE IF NOT EXISTS public.insumo_saidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE RESTRICT,
  kit_id uuid REFERENCES public.kits(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  retornavel boolean NOT NULL DEFAULT false,
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tecnico_id uuid NOT NULL REFERENCES public.tecnicos(id) ON DELETE RESTRICT,
  registrado_por uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente_aprovacao'
    CHECK (status IN ('pendente_aprovacao','aprovada','rejeitada','devolvida_total','devolvida_parcial')),
  quantidade_devolvida integer NOT NULL DEFAULT 0,
  aprovado_por uuid,
  aprovado_at timestamptz,
  rejeitado_motivo text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_insumo_or_kit CHECK (
    (insumo_id IS NOT NULL AND kit_id IS NULL)
    OR (insumo_id IS NULL AND kit_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_insumo_saidas_os ON public.insumo_saidas(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_insumo_saidas_tecnico ON public.insumo_saidas(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_insumo_saidas_status ON public.insumo_saidas(status);

ALTER TABLE public.insumo_saidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View saidas: staff backoffice or technician owner"
ON public.insumo_saidas FOR SELECT
USING (
  public.is_staff_or_backoffice(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tecnicos t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.id = insumo_saidas.tecnico_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Insert saidas: staff backoffice or technician self"
ON public.insumo_saidas FOR INSERT
WITH CHECK (
  public.is_staff_or_backoffice(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tecnicos t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.id = insumo_saidas.tecnico_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Update saidas: only staff and backoffice"
ON public.insumo_saidas FOR UPDATE
USING (public.is_staff_or_backoffice(auth.uid()))
WITH CHECK (public.is_staff_or_backoffice(auth.uid()));

CREATE POLICY "Delete saidas: only admin"
ON public.insumo_saidas FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_insumo_saidas_updated_at
BEFORE UPDATE ON public.insumo_saidas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5. Tabela insumo_devolucoes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.insumo_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saida_id uuid NOT NULL REFERENCES public.insumo_saidas(id) ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  status text NOT NULL DEFAULT 'pendente_aprovacao'
    CHECK (status IN ('pendente_aprovacao','aprovada','rejeitada')),
  registrada_por uuid NOT NULL,
  aprovado_por uuid,
  aprovado_at timestamptz,
  observacoes text,
  rejeitado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumo_devolucoes_saida ON public.insumo_devolucoes(saida_id);
CREATE INDEX IF NOT EXISTS idx_insumo_devolucoes_status ON public.insumo_devolucoes(status);

ALTER TABLE public.insumo_devolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View devolucoes: staff backoffice or technician owner"
ON public.insumo_devolucoes FOR SELECT
USING (
  public.is_staff_or_backoffice(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.insumo_saidas s
    JOIN public.tecnicos t ON t.id = s.tecnico_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE s.id = insumo_devolucoes.saida_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Insert devolucoes: staff backoffice or technician owner"
ON public.insumo_devolucoes FOR INSERT
WITH CHECK (
  public.is_staff_or_backoffice(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.insumo_saidas s
    JOIN public.tecnicos t ON t.id = s.tecnico_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE s.id = insumo_devolucoes.saida_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Update devolucoes: only staff and backoffice"
ON public.insumo_devolucoes FOR UPDATE
USING (public.is_staff_or_backoffice(auth.uid()))
WITH CHECK (public.is_staff_or_backoffice(auth.uid()));

CREATE TRIGGER trg_insumo_devolucoes_updated_at
BEFORE UPDATE ON public.insumo_devolucoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. Triggers de estoque
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_insumo_saida_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.insumo_id IS NOT NULL THEN
    UPDATE public.insumos
       SET quantidade = quantidade - NEW.quantidade,
           updated_at = now()
     WHERE id = NEW.insumo_id;
  ELSIF NEW.kit_id IS NOT NULL THEN
    UPDATE public.insumos i
       SET quantidade = i.quantidade - (ki.quantidade * NEW.quantidade),
           updated_at = now()
      FROM public.kit_itens ki
     WHERE ki.kit_id = NEW.kit_id
       AND i.id = ki.insumo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_insumo_saida_estoque
AFTER INSERT ON public.insumo_saidas
FOR EACH ROW EXECUTE FUNCTION public.handle_insumo_saida_estoque();

CREATE OR REPLACE FUNCTION public.handle_insumo_saida_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejeitada' THEN
    IF NEW.insumo_id IS NOT NULL THEN
      UPDATE public.insumos
         SET quantidade = quantidade + NEW.quantidade,
             updated_at = now()
       WHERE id = NEW.insumo_id;
    ELSIF NEW.kit_id IS NOT NULL THEN
      UPDATE public.insumos i
         SET quantidade = i.quantidade + (ki.quantidade * NEW.quantidade),
             updated_at = now()
        FROM public.kit_itens ki
       WHERE ki.kit_id = NEW.kit_id
         AND i.id = ki.insumo_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_insumo_saida_status_change
AFTER UPDATE ON public.insumo_saidas
FOR EACH ROW EXECUTE FUNCTION public.handle_insumo_saida_status_change();

CREATE OR REPLACE FUNCTION public.handle_devolucao_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saida public.insumo_saidas%ROWTYPE;
  v_total_devolvido integer;
  v_novo_status text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'aprovada')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'aprovada') THEN

    SELECT * INTO v_saida FROM public.insumo_saidas WHERE id = NEW.saida_id;

    IF v_saida.insumo_id IS NOT NULL THEN
      UPDATE public.insumos
         SET quantidade = quantidade + NEW.quantidade,
             updated_at = now()
       WHERE id = v_saida.insumo_id;
    ELSIF v_saida.kit_id IS NOT NULL THEN
      UPDATE public.insumos i
         SET quantidade = i.quantidade + (ki.quantidade * NEW.quantidade),
             updated_at = now()
        FROM public.kit_itens ki
       WHERE ki.kit_id = v_saida.kit_id
         AND i.id = ki.insumo_id;
    END IF;

    v_total_devolvido := v_saida.quantidade_devolvida + NEW.quantidade;
    IF v_total_devolvido >= v_saida.quantidade THEN
      v_novo_status := 'devolvida_total';
    ELSE
      v_novo_status := 'devolvida_parcial';
    END IF;

    UPDATE public.insumo_saidas
       SET quantidade_devolvida = v_total_devolvido,
           status = v_novo_status,
           updated_at = now()
     WHERE id = NEW.saida_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_devolucao_aprovada
AFTER INSERT OR UPDATE ON public.insumo_devolucoes
FOR EACH ROW EXECUTE FUNCTION public.handle_devolucao_aprovada();

-- =========================================================
-- 7. RPCs auxiliares
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_tecnico_os_ativas(p_tecnico_id uuid)
RETURNS TABLE (
  ordem_servico_id uuid,
  numero_os text,
  ticket_titulo text,
  cliente text,
  data_programada timestamptz,
  ticket_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    os.id,
    os.numero_os,
    t.titulo,
    COALESCE(c.empresa, '—'),
    os.data_programada,
    t.status::text
  FROM public.ordens_servico os
  JOIN public.tickets t ON t.id = os.ticket_id
  LEFT JOIN public.clientes c ON c.id = t.cliente_id
  WHERE os.tecnico_id = p_tecnico_id
    AND os.aceite_tecnico IN ('aceito','aprovado')
    AND t.status IN ('ordem_servico_gerada','em_execucao','aguardando_rme')
  ORDER BY os.data_programada DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_rme_pendencias_insumos(p_rme_id uuid)
RETURNS TABLE (
  saida_id uuid,
  ordem_servico_id uuid,
  numero_os text,
  insumo_nome text,
  kit_nome text,
  quantidade integer,
  quantidade_devolvida integer,
  retornavel boolean,
  status text,
  tecnico_nome text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ticket AS (
    SELECT t.id AS ticket_id
    FROM public.rme_relatorios r
    JOIN public.ordens_servico os ON os.id = r.ordem_servico_id
    JOIN public.tickets t ON t.id = os.ticket_id
    WHERE r.id = p_rme_id
    LIMIT 1
  )
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
    p.nome
  FROM public.insumo_saidas s
  JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN ticket tk ON tk.ticket_id = os.ticket_id
  JOIN public.tecnicos tec ON tec.id = s.tecnico_id
  JOIN public.profiles p ON p.id = tec.profile_id
  LEFT JOIN public.insumos i ON i.id = s.insumo_id
  LEFT JOIN public.kits k ON k.id = s.kit_id
  WHERE os.aceite_tecnico IN ('aceito','aprovado')
  ORDER BY s.created_at DESC;
$$;

-- =========================================================
-- 8. Notificar backoffice quando RME é aprovado
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_backoffice_rme_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pendencias integer;
  v_user record;
  v_numero_os text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'aprovado' THEN
    SELECT count(*) INTO v_pendencias
    FROM public.get_rme_pendencias_insumos(NEW.id) p
    WHERE p.status IN ('pendente_aprovacao','devolvida_parcial','aprovada');

    IF v_pendencias > 0 THEN
      SELECT numero_os INTO v_numero_os FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;

      FOR v_user IN
        SELECT user_id FROM public.user_roles WHERE role = 'backoffice'::app_role
      LOOP
        INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
        VALUES (
          v_user.user_id,
          'insumos_pendencia',
          'RME aprovado com pendências de insumos',
          'O RME da OS ' || COALESCE(v_numero_os, '') || ' foi aprovado e possui ' || v_pendencias || ' saída(s) de insumo(s) pendente(s) de validação/devolução.',
          '/backoffice/insumos'
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_backoffice_rme_aprovado
AFTER UPDATE ON public.rme_relatorios
FOR EACH ROW EXECUTE FUNCTION public.notify_backoffice_rme_aprovado();

-- =========================================================
-- 9. Bloquear devoluções após RME aprovado
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_devolucao_rme_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rme_status text;
BEGIN
  SELECT r.status INTO v_rme_status
  FROM public.insumo_saidas s
  JOIN public.ordens_servico os ON os.id = s.ordem_servico_id
  JOIN public.rme_relatorios r ON r.ordem_servico_id IN (
    SELECT os2.id FROM public.ordens_servico os2 WHERE os2.ticket_id = os.ticket_id
  )
  WHERE s.id = NEW.saida_id
  ORDER BY r.updated_at DESC
  LIMIT 1;

  IF v_rme_status = 'aprovado' THEN
    RAISE EXCEPTION 'Não é possível registrar devolução: o RME do ticket já foi aprovado.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_devolucao_rme_status
BEFORE INSERT ON public.insumo_devolucoes
FOR EACH ROW EXECUTE FUNCTION public.check_devolucao_rme_status();