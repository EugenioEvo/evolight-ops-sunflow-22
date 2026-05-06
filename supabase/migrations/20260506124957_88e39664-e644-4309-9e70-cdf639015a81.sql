
-- ============ TABLES (sem políticas) ============

CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  endereco text, cidade text, estado text, cep text,
  latitude numeric, longitude numeric, potencia_kwp numeric,
  data_inicio_prevista date, data_fim_prevista date,
  data_inicio_real date, data_fim_real date,
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','em_execucao','pausada','concluida','cancelada')),
  responsavel_obra_id uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_obras_cliente ON public.obras(cliente_id);
CREATE INDEX idx_obras_status ON public.obras(status);
CREATE INDEX idx_obras_responsavel ON public.obras(responsavel_obra_id);
CREATE TRIGGER trg_obras_updated_at BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rdo_atividades_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL UNIQUE,
  label text NOT NULL,
  unidade text NOT NULL,
  categoria text NOT NULL,
  sort_order int DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rdo_atividades_catalogo (item_key, label, unidade, categoria, sort_order) VALUES
  ('modulos_montados', 'Módulos fotovoltaicos montados', 'un', 'Montagem', 10),
  ('estrutura_metalica_instalada', 'Estrutura metálica instalada', 'm', 'Estrutura', 20),
  ('estacas_cravadas', 'Estacas cravadas', 'un', 'Estrutura', 30),
  ('cabo_cc_lancado', 'Cabo CC lançado', 'm', 'Elétrica CC', 40),
  ('cabo_ca_lancado', 'Cabo CA lançado', 'm', 'Elétrica CA', 50),
  ('eletrodutos_instalados', 'Eletrodutos instalados', 'm', 'Elétrica', 60),
  ('string_box_instalada', 'String box instalada', 'un', 'Elétrica CC', 70),
  ('inversores_instalados', 'Inversores instalados', 'un', 'Elétrica CA', 80),
  ('aterramento_executado', 'Aterramento executado', 'm', 'Elétrica', 90),
  ('limpeza_canteiro', 'Limpeza de canteiro', 'm²', 'Apoio', 100);

CREATE OR REPLACE FUNCTION public.user_is_prestador(_user_id uuid, _prestador_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tecnicos t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.prestador_id = _prestador_id AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.gerar_numero_rdo()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE proximo_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_rdo FROM '[0-9]+') AS INTEGER)), 0) + 1
    INTO proximo_numero FROM public.rdo_relatorios
   WHERE numero_rdo ~ '^RDO[0-9]+$';
  RETURN 'RDO' || LPAD(proximo_numero::TEXT, 6, '0');
END;
$$;

CREATE TABLE public.rdo_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_rdo text NOT NULL UNIQUE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  data_rdo date NOT NULL,
  turno text CHECK (turno IN ('manha','tarde','integral','noite')),
  clima text CHECK (clima IN ('sol','nublado','chuva_leve','chuva_forte','vento_forte','outro')),
  temperatura_c numeric,
  condicoes_canteiro text,
  horario_inicio time, horario_fim time,
  observacoes_gerais text, ocorrencias text, atrasos text, restricoes text,
  responsavel_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','pendente','aprovado','rejeitado','cancelado')),
  aprovado_por uuid, data_aprovacao timestamptz, observacoes_aprovacao text,
  assinatura_responsavel text, assinatura_aprovador text,
  fotos_geral text[], pdf_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_rdo_obra_data_ativo ON public.rdo_relatorios(obra_id, data_rdo) WHERE status <> 'cancelado';
CREATE INDEX idx_rdo_status ON public.rdo_relatorios(status);
CREATE INDEX idx_rdo_responsavel ON public.rdo_relatorios(responsavel_id);
CREATE INDEX idx_rdo_obra ON public.rdo_relatorios(obra_id);
CREATE TRIGGER trg_rdo_updated_at BEFORE UPDATE ON public.rdo_relatorios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trigger_gerar_numero_rdo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.numero_rdo IS NULL OR NEW.numero_rdo = '' THEN
    NEW.numero_rdo := public.gerar_numero_rdo();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_rdo_numero BEFORE INSERT ON public.rdo_relatorios
  FOR EACH ROW EXECUTE FUNCTION public.trigger_gerar_numero_rdo();

CREATE TABLE public.rdo_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo_relatorios(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE RESTRICT,
  funcao text,
  horas_trabalhadas numeric DEFAULT 0,
  horas_extras numeric DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rdo_id, prestador_id)
);

CREATE TABLE public.rdo_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo_relatorios(id) ON DELETE CASCADE,
  catalogo_id uuid REFERENCES public.rdo_atividades_catalogo(id) ON DELETE SET NULL,
  descricao_livre text,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text,
  percentual_avanco numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (catalogo_id IS NOT NULL OR descricao_livre IS NOT NULL)
);

CREATE TABLE public.rdo_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo_relatorios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rdo_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo_relatorios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('antes','depois','ocorrencia','epi','geral')),
  storage_path text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ ENABLE RLS ============
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_atividades_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_evidencias ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============

CREATE POLICY "Staff manage obras" ON public.obras
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Eletromecanicos view obras" ON public.obras
  FOR SELECT USING (
    public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'eletromecanico'::app_role)
  );

CREATE POLICY "Authenticated view rdo catalogo" ON public.rdo_atividades_catalogo
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manages rdo catalogo" ON public.rdo_atividades_catalogo
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff manage RDO" ON public.rdo_relatorios
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Sup eletromec creates own RDO" ON public.rdo_relatorios
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    AND public.user_is_prestador(auth.uid(), responsavel_id)
  );
CREATE POLICY "Sup eletromec updates own RDO drafts" ON public.rdo_relatorios
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    AND public.user_is_prestador(auth.uid(), responsavel_id)
    AND status IN ('rascunho','rejeitado')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    AND public.user_is_prestador(auth.uid(), responsavel_id)
    AND status IN ('rascunho','rejeitado','pendente')
  );
CREATE POLICY "View RDO if responsible or in equipe" ON public.rdo_relatorios
  FOR SELECT USING (
    public.is_staff(auth.uid())
    OR public.user_is_prestador(auth.uid(), responsavel_id)
    OR EXISTS (
      SELECT 1 FROM public.rdo_equipe e
      WHERE e.rdo_id = rdo_relatorios.id
        AND public.user_is_prestador(auth.uid(), e.prestador_id)
    )
  );

CREATE POLICY "Staff manage rdo equipe" ON public.rdo_equipe
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Sup eletromec manages own RDO equipe" ON public.rdo_equipe
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_equipe.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_equipe.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  );
CREATE POLICY "View rdo equipe if envolvido" ON public.rdo_equipe
  FOR SELECT USING (
    public.is_staff(auth.uid())
    OR public.user_is_prestador(auth.uid(), prestador_id)
    OR EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_equipe.rdo_id
               AND public.user_is_prestador(auth.uid(), r.responsavel_id))
  );

CREATE POLICY "Staff manage rdo atividades" ON public.rdo_atividades
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Sup eletromec manages own RDO atividades" ON public.rdo_atividades
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_atividades.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_atividades.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  );
CREATE POLICY "View rdo atividades if envolvido" ON public.rdo_atividades
  FOR SELECT USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_atividades.rdo_id
               AND (public.user_is_prestador(auth.uid(), r.responsavel_id)
                    OR EXISTS (SELECT 1 FROM public.rdo_equipe e
                               WHERE e.rdo_id = r.id
                                 AND public.user_is_prestador(auth.uid(), e.prestador_id))))
  );

CREATE POLICY "Staff manage rdo equipamentos" ON public.rdo_equipamentos
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Sup eletromec manages own RDO equipamentos" ON public.rdo_equipamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_equipamentos.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_equipamentos.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  );
CREATE POLICY "View rdo equipamentos if envolvido" ON public.rdo_equipamentos
  FOR SELECT USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_equipamentos.rdo_id
               AND (public.user_is_prestador(auth.uid(), r.responsavel_id)
                    OR EXISTS (SELECT 1 FROM public.rdo_equipe e
                               WHERE e.rdo_id = r.id
                                 AND public.user_is_prestador(auth.uid(), e.prestador_id))))
  );

CREATE POLICY "Staff manage rdo evidencias" ON public.rdo_evidencias
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Sup eletromec manages own RDO evidencias" ON public.rdo_evidencias
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_evidencias.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_evidencias.rdo_id
            AND public.user_is_prestador(auth.uid(), r.responsavel_id)
            AND r.status IN ('rascunho','rejeitado'))
  );
CREATE POLICY "View rdo evidencias if envolvido" ON public.rdo_evidencias
  FOR SELECT USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rdo_relatorios r WHERE r.id = rdo_evidencias.rdo_id
               AND (public.user_is_prestador(auth.uid(), r.responsavel_id)
                    OR EXISTS (SELECT 1 FROM public.rdo_equipe e
                               WHERE e.rdo_id = r.id
                                 AND public.user_is_prestador(auth.uid(), e.prestador_id))))
  );

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('rdo-evidences', 'rdo-evidences', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff read rdo evidences" ON storage.objects
  FOR SELECT USING (bucket_id = 'rdo-evidences' AND public.is_staff(auth.uid()));
CREATE POLICY "Eletromec read rdo evidences" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'rdo-evidences'
    AND (public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
         OR public.has_role(auth.uid(), 'eletromecanico'::app_role))
  );
CREATE POLICY "Sup eletromec upload rdo evidences" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'rdo-evidences'
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'sup_eletromecanico'::app_role))
  );
CREATE POLICY "Staff/sup delete rdo evidences" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'rdo-evidences'
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'sup_eletromecanico'::app_role))
  );
