-- 0) Permitir origem 'manual'
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_origem_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_origem_check
  CHECK (origem IS NULL OR origem = ANY (ARRAY['solarz'::text, 'conta_azul'::text, 'manual'::text]));

-- 1) Campos novos em clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS atrasos_recebimentos numeric,
  ADD COLUMN IF NOT EXISTS status_financeiro_ca text,
  ADD COLUMN IF NOT EXISTS ufv_status_resumo text;

COMMENT ON COLUMN public.clientes.observacoes IS 'Anotações operacionais internas (não sincronizadas com Solarz/CA).';
COMMENT ON COLUMN public.clientes.atrasos_recebimentos IS 'Valor em atraso lido de pessoas.atrasos_recebimentos no Conta Azul.';
COMMENT ON COLUMN public.clientes.status_financeiro_ca IS 'OK | INADIMPLENTE — derivado de atrasos_recebimentos > 0.';
COMMENT ON COLUMN public.clientes.ufv_status_resumo IS 'Resumo do status agregado das UFVs (OK / ALERTA / SEM_UFV).';

-- 2) Merge de duplicatas por CNPJ/CPF normalizado
DO $$
DECLARE
  v_canonical uuid;
  v_doc text;
  v_obs text;
BEGIN
  FOR v_doc IN
    SELECT regexp_replace(cnpj_cpf, '\D', '', 'g') AS doc
    FROM public.clientes
    WHERE cnpj_cpf IS NOT NULL AND cnpj_cpf <> ''
    GROUP BY 1
    HAVING COUNT(*) > 1
  LOOP
    SELECT c.id INTO v_canonical
    FROM public.clientes c
    LEFT JOIN (
      SELECT cliente_id, COUNT(*) AS qt FROM public.tickets GROUP BY cliente_id
    ) tk ON tk.cliente_id = c.id
    WHERE regexp_replace(c.cnpj_cpf, '\D', '', 'g') = v_doc
    ORDER BY
      CASE c.origem
        WHEN 'solarz' THEN 1
        WHEN 'conta_azul' THEN 2
        ELSE 3
      END,
      COALESCE(tk.qt, 0) DESC,
      c.created_at ASC
    LIMIT 1;

    SELECT string_agg(DISTINCT NULLIF(trim(observacoes), ''), E'\n---\n')
      INTO v_obs
    FROM public.clientes
    WHERE regexp_replace(cnpj_cpf, '\D', '', 'g') = v_doc
      AND id <> v_canonical
      AND observacoes IS NOT NULL;

    UPDATE public.tickets       SET cliente_id = v_canonical
      WHERE cliente_id IN (
        SELECT id FROM public.clientes
        WHERE regexp_replace(cnpj_cpf, '\D', '', 'g') = v_doc AND id <> v_canonical
      );
    UPDATE public.equipamentos  SET cliente_id = v_canonical
      WHERE cliente_id IN (
        SELECT id FROM public.clientes
        WHERE regexp_replace(cnpj_cpf, '\D', '', 'g') = v_doc AND id <> v_canonical
      );
    UPDATE public.cliente_ufvs  SET cliente_id = v_canonical
      WHERE cliente_id IN (
        SELECT id FROM public.clientes
        WHERE regexp_replace(cnpj_cpf, '\D', '', 'g') = v_doc AND id <> v_canonical
      );
    UPDATE public.cliente_conta_azul_ids SET cliente_id = v_canonical
      WHERE cliente_id IN (
        SELECT id FROM public.clientes
        WHERE regexp_replace(cnpj_cpf, '\D', '', 'g') = v_doc AND id <> v_canonical
      );

    IF v_obs IS NOT NULL THEN
      UPDATE public.clientes
      SET observacoes = trim(both E'\n' from concat_ws(E'\n---\n', NULLIF(trim(observacoes), ''), v_obs)),
          updated_at = now()
      WHERE id = v_canonical;
    END IF;

    DELETE FROM public.clientes
    WHERE regexp_replace(cnpj_cpf, '\D', '', 'g') = v_doc
      AND id <> v_canonical;
  END LOOP;
END $$;

-- 3) Marcar legados como 'manual'
UPDATE public.clientes SET origem = 'manual' WHERE origem IS NULL;

-- 4) Índice único parcial por documento normalizado
CREATE UNIQUE INDEX IF NOT EXISTS clientes_doc_normalized_uniq
ON public.clientes ((regexp_replace(cnpj_cpf, '\D', '', 'g')))
WHERE cnpj_cpf IS NOT NULL AND cnpj_cpf <> '';