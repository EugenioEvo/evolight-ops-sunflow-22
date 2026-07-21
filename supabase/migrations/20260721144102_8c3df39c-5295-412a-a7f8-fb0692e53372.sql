
-- ============ HSE Phase 1: Certifications ============

-- 1) Types catalog
CREATE TABLE public.hse_certificacao_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  obrigatoria BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_certificacao_tipos TO authenticated;
GRANT ALL ON public.hse_certificacao_tipos TO service_role;
ALTER TABLE public.hse_certificacao_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read tipos" ON public.hse_certificacao_tipos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write tipos" ON public.hse_certificacao_tipos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_hse_tipos_updated BEFORE UPDATE ON public.hse_certificacao_tipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Certifications
CREATE TABLE public.hse_certificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id UUID NOT NULL REFERENCES public.hse_certificacao_tipos(id) ON DELETE RESTRICT,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
  data_vencimento DATE,
  observacoes TEXT,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','migrado_legado')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hse_cert_one_owner CHECK (
    (profile_id IS NOT NULL AND prestador_id IS NULL) OR
    (profile_id IS NULL AND prestador_id IS NOT NULL)
  )
);
CREATE INDEX ix_hse_cert_profile ON public.hse_certificacoes(profile_id);
CREATE INDEX ix_hse_cert_prestador ON public.hse_certificacoes(prestador_id);
CREATE INDEX ix_hse_cert_venc ON public.hse_certificacoes(data_vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_certificacoes TO authenticated;
GRANT ALL ON public.hse_certificacoes TO service_role;
ALTER TABLE public.hse_certificacoes ENABLE ROW LEVEL SECURITY;

-- Owner check helper
CREATE OR REPLACE FUNCTION public.hse_cert_is_owner(_user_id uuid, _profile_id uuid, _prestador_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    (_profile_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=_profile_id AND p.user_id=_user_id))
    OR
    (_prestador_id IS NOT NULL AND public.user_is_prestador(_user_id, _prestador_id))
$$;

CREATE POLICY "staff/bo + owner read certs" ON public.hse_certificacoes
  FOR SELECT TO authenticated USING (
    public.is_staff_or_backoffice(auth.uid())
    OR public.hse_cert_is_owner(auth.uid(), profile_id, prestador_id)
  );
CREATE POLICY "staff/bo write certs" ON public.hse_certificacoes
  FOR ALL TO authenticated
  USING (public.is_staff_or_backoffice(auth.uid()))
  WITH CHECK (public.is_staff_or_backoffice(auth.uid()));
-- Owner can update their own certs (to complete vencimento/observacoes)
CREATE POLICY "owner update own certs" ON public.hse_certificacoes
  FOR UPDATE TO authenticated
  USING (public.hse_cert_is_owner(auth.uid(), profile_id, prestador_id))
  WITH CHECK (public.hse_cert_is_owner(auth.uid(), profile_id, prestador_id));

CREATE TRIGGER trg_hse_cert_updated BEFORE UPDATE ON public.hse_certificacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Attachments
CREATE TABLE public.hse_certificacao_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificacao_id UUID NOT NULL REFERENCES public.hse_certificacoes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_original TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_hse_anexo_cert ON public.hse_certificacao_anexos(certificacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_certificacao_anexos TO authenticated;
GRANT ALL ON public.hse_certificacao_anexos TO service_role;
ALTER TABLE public.hse_certificacao_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read anexos if can read cert" ON public.hse_certificacao_anexos
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.hse_certificacoes c
      WHERE c.id = certificacao_id AND (
        public.is_staff_or_backoffice(auth.uid())
        OR public.hse_cert_is_owner(auth.uid(), c.profile_id, c.prestador_id)
      )
    )
  );
CREATE POLICY "write anexos if can write cert" ON public.hse_certificacao_anexos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hse_certificacoes c
      WHERE c.id = certificacao_id AND (
        public.is_staff_or_backoffice(auth.uid())
        OR public.hse_cert_is_owner(auth.uid(), c.profile_id, c.prestador_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hse_certificacoes c
      WHERE c.id = certificacao_id AND (
        public.is_staff_or_backoffice(auth.uid())
        OR public.hse_cert_is_owner(auth.uid(), c.profile_id, c.prestador_id)
      )
    )
  );

-- 4) Seed catálogo com valores conhecidos (fixos + existentes em prestadores.certificacoes)
INSERT INTO public.hse_certificacao_tipos (nome) VALUES
  ('NR-10'), ('NR-35'), ('NR-33'), ('NR-11'), ('NR-12'), ('NR-06'),
  ('CREA'), ('CAT'), ('Fotovoltaica'), ('Gestão de Projetos'), ('ASO')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.hse_certificacao_tipos (nome)
SELECT DISTINCT trim(c)
FROM public.prestadores, LATERAL unnest(certificacoes) AS c
WHERE certificacoes IS NOT NULL AND trim(c) <> ''
ON CONFLICT (nome) DO NOTHING;

-- 5) Backfill dos legados
INSERT INTO public.hse_certificacoes (tipo_id, prestador_id, origem, observacoes)
SELECT t.id, p.id, 'migrado_legado',
       'Migrado do cadastro legado — preencher vencimento e anexar comprovante.'
FROM public.prestadores p
CROSS JOIN LATERAL unnest(p.certificacoes) AS c
JOIN public.hse_certificacao_tipos t
  ON lower(trim(t.nome)) = lower(trim(c))
WHERE p.certificacoes IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.hse_certificacoes x
    WHERE x.prestador_id = p.id AND x.tipo_id = t.id
  );
