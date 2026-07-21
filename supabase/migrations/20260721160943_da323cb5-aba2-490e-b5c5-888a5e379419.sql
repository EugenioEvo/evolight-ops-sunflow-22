
-- ============ FASE 2: dedupe de alertas ============
CREATE TABLE public.hse_certificacao_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificacao_id UUID NOT NULL REFERENCES public.hse_certificacoes(id) ON DELETE CASCADE,
  janela_dias INTEGER NOT NULL, -- 30, 7, 0
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (certificacao_id, janela_dias)
);

GRANT SELECT ON public.hse_certificacao_alertas TO authenticated;
GRANT ALL ON public.hse_certificacao_alertas TO service_role;

ALTER TABLE public.hse_certificacao_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pode ler alertas HSE"
ON public.hse_certificacao_alertas FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));

-- ============ FASE 3: afastamentos ============
CREATE TABLE public.hse_afastamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  nome_customizado TEXT,
  vinculo TEXT NOT NULL CHECK (vinculo IN ('contratado','subcontratado')),
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  local_customizado TEXT,
  data_acidente DATE NOT NULL,
  descricao TEXT NOT NULL,
  data_afastamento DATE NOT NULL,
  dias_afastado INTEGER NOT NULL CHECK (dias_afastado >= 0),
  data_retorno DATE NOT NULL,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT hse_afastamentos_pessoa_check CHECK (
    (profile_id IS NOT NULL)::int
    + (prestador_id IS NOT NULL)::int
    + (nome_customizado IS NOT NULL AND nome_customizado <> '')::int = 1
  ),
  CONSTRAINT hse_afastamentos_local_check CHECK (
    (obra_id IS NOT NULL)::int
    + (local_customizado IS NOT NULL AND local_customizado <> '')::int <= 1
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_afastamentos TO authenticated;
GRANT ALL ON public.hse_afastamentos TO service_role;

ALTER TABLE public.hse_afastamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/engenharia gerenciam afastamentos"
ON public.hse_afastamentos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'engenharia'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'engenharia'));

CREATE TRIGGER trg_hse_afastamentos_updated_at
BEFORE UPDATE ON public.hse_afastamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hse_afastamentos_data ON public.hse_afastamentos(data_afastamento DESC);
CREATE INDEX idx_hse_afastamentos_obra ON public.hse_afastamentos(obra_id);
