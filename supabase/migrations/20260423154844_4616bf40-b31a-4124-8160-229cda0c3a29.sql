-- 1. Novas colunas em clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS solarz_customer_id text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS sync_source_updated_at timestamptz;

-- Constraint de origem
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_origem_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_origem_check
  CHECK (origem IS NULL OR origem IN ('solarz','conta_azul'));

-- Unicidade do solarz_customer_id (parcial, permite null)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_solarz_customer_id_key
  ON public.clientes(solarz_customer_id)
  WHERE solarz_customer_id IS NOT NULL;

-- Coluna gerada sem_solarz
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS sem_solarz boolean
  GENERATED ALWAYS AS (solarz_customer_id IS NULL) STORED;

-- 2. Tabela cliente_conta_azul_ids
CREATE TABLE IF NOT EXISTS public.cliente_conta_azul_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  conta_azul_customer_id text NOT NULL UNIQUE,
  nome_fiscal text,
  cnpj_cpf text,
  email text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cliente_conta_azul_ids_cliente_id_idx
  ON public.cliente_conta_azul_ids(cliente_id);

ALTER TABLE public.cliente_conta_azul_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage cliente_conta_azul_ids" ON public.cliente_conta_azul_ids;
CREATE POLICY "Staff manage cliente_conta_azul_ids"
  ON public.cliente_conta_azul_ids FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role manages cliente_conta_azul_ids" ON public.cliente_conta_azul_ids;
CREATE POLICY "Service role manages cliente_conta_azul_ids"
  ON public.cliente_conta_azul_ids FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Clients view own cliente_conta_azul_ids" ON public.cliente_conta_azul_ids;
CREATE POLICY "Clients view own cliente_conta_azul_ids"
  ON public.cliente_conta_azul_ids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      JOIN public.profiles p ON p.id = c.profile_id
      WHERE c.id = cliente_conta_azul_ids.cliente_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Technicians view assigned cliente_conta_azul_ids" ON public.cliente_conta_azul_ids;
CREATE POLICY "Technicians view assigned cliente_conta_azul_ids"
  ON public.cliente_conta_azul_ids FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tecnico_campo'::app_role)
    AND public.can_tech_view_cliente(auth.uid(), cliente_id)
  );

-- 3. Tabela cliente_ufvs
CREATE TABLE IF NOT EXISTS public.cliente_ufvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  solarz_ufv_id text NOT NULL UNIQUE,
  nome text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  latitude numeric,
  longitude numeric,
  potencia_kwp numeric,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cliente_ufvs_cliente_id_idx
  ON public.cliente_ufvs(cliente_id);

ALTER TABLE public.cliente_ufvs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage cliente_ufvs" ON public.cliente_ufvs;
CREATE POLICY "Staff manage cliente_ufvs"
  ON public.cliente_ufvs FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role manages cliente_ufvs" ON public.cliente_ufvs;
CREATE POLICY "Service role manages cliente_ufvs"
  ON public.cliente_ufvs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Clients view own cliente_ufvs" ON public.cliente_ufvs;
CREATE POLICY "Clients view own cliente_ufvs"
  ON public.cliente_ufvs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      JOIN public.profiles p ON p.id = c.profile_id
      WHERE c.id = cliente_ufvs.cliente_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Technicians view assigned cliente_ufvs" ON public.cliente_ufvs;
CREATE POLICY "Technicians view assigned cliente_ufvs"
  ON public.cliente_ufvs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tecnico_campo'::app_role)
    AND public.can_tech_view_cliente(auth.uid(), cliente_id)
  );

-- 4. Tabela sync_runs
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  rows_read integer NOT NULL DEFAULT 0,
  rows_upserted integer NOT NULL DEFAULT 0,
  error text,
  last_sync_cursor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_runs_source_started_idx
  ON public.sync_runs(source, started_at DESC);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view sync_runs" ON public.sync_runs;
CREATE POLICY "Staff view sync_runs"
  ON public.sync_runs FOR SELECT
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role manages sync_runs" ON public.sync_runs;
CREATE POLICY "Service role manages sync_runs"
  ON public.sync_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 5. Triggers de updated_at
DROP TRIGGER IF EXISTS trg_cliente_conta_azul_ids_updated_at ON public.cliente_conta_azul_ids;
CREATE TRIGGER trg_cliente_conta_azul_ids_updated_at
  BEFORE UPDATE ON public.cliente_conta_azul_ids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cliente_ufvs_updated_at ON public.cliente_ufvs;
CREATE TRIGGER trg_cliente_ufvs_updated_at
  BEFORE UPDATE ON public.cliente_ufvs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Índice único parcial em cnpj_cpf (previne duplicatas futuras; ignora nulls)
-- NOTA: se houver duplicatas atuais, este índice falhará. Removemos a criação condicional abaixo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'clientes_cnpj_cpf_unique_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX clientes_cnpj_cpf_unique_idx
        ON public.clientes(cnpj_cpf)
        WHERE cnpj_cpf IS NOT NULL AND cnpj_cpf <> '';
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Índice único em cnpj_cpf não criado — existem duplicatas. Resolver manualmente e recriar.';
    END;
  END IF;
END$$;