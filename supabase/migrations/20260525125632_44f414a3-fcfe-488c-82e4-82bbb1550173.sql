
-- Helper functions (SECURITY DEFINER, bypass RLS)
CREATE OR REPLACE FUNCTION public.user_in_rdo_equipe(_uid uuid, _rdo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rdo_equipe e
    WHERE e.rdo_id = _rdo_id
      AND public.user_is_prestador(_uid, e.prestador_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_rdo_responsavel(_uid uuid, _rdo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rdo_relatorios r
    WHERE r.id = _rdo_id
      AND public.user_is_prestador(_uid, r.responsavel_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.rdo_status(_rdo_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status FROM public.rdo_relatorios WHERE id = _rdo_id
$$;

-- rdo_relatorios: replace recursive SELECT policy
DROP POLICY IF EXISTS "View RDO if responsible or in equipe" ON public.rdo_relatorios;
CREATE POLICY "View RDO if responsible or in equipe"
ON public.rdo_relatorios FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR public.user_is_prestador(auth.uid(), responsavel_id)
  OR public.user_in_rdo_equipe(auth.uid(), id)
);

-- rdo_equipe: replace recursive SELECT policy
DROP POLICY IF EXISTS "View rdo equipe if envolvido" ON public.rdo_equipe;
CREATE POLICY "View rdo equipe if envolvido"
ON public.rdo_equipe FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR public.user_is_prestador(auth.uid(), prestador_id)
  OR public.user_is_rdo_responsavel(auth.uid(), rdo_id)
);

-- rdo_atividades: replace recursive SELECT policy + manage policy
DROP POLICY IF EXISTS "View rdo atividades if envolvido" ON public.rdo_atividades;
CREATE POLICY "View rdo atividades if envolvido"
ON public.rdo_atividades FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  OR public.user_in_rdo_equipe(auth.uid(), rdo_id)
);

DROP POLICY IF EXISTS "Sup eletromec manages own RDO atividades" ON public.rdo_atividades;
CREATE POLICY "Sup eletromec manages own RDO atividades"
ON public.rdo_atividades FOR ALL
USING (
  public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  AND public.rdo_status(rdo_id) = ANY (ARRAY['rascunho'::text, 'rejeitado'::text])
)
WITH CHECK (
  public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  AND public.rdo_status(rdo_id) = ANY (ARRAY['rascunho'::text, 'rejeitado'::text])
);

-- rdo_equipamentos: replace recursive SELECT policy + manage policy
DROP POLICY IF EXISTS "View rdo equipamentos if envolvido" ON public.rdo_equipamentos;
CREATE POLICY "View rdo equipamentos if envolvido"
ON public.rdo_equipamentos FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  OR public.user_in_rdo_equipe(auth.uid(), rdo_id)
);

DROP POLICY IF EXISTS "Sup eletromec manages own RDO equipamentos" ON public.rdo_equipamentos;
CREATE POLICY "Sup eletromec manages own RDO equipamentos"
ON public.rdo_equipamentos FOR ALL
USING (
  public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  AND public.rdo_status(rdo_id) = ANY (ARRAY['rascunho'::text, 'rejeitado'::text])
)
WITH CHECK (
  public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  AND public.rdo_status(rdo_id) = ANY (ARRAY['rascunho'::text, 'rejeitado'::text])
);

-- Also fix rdo_equipe manage policy (same recursion pattern)
DROP POLICY IF EXISTS "Sup eletromec manages own RDO equipe" ON public.rdo_equipe;
CREATE POLICY "Sup eletromec manages own RDO equipe"
ON public.rdo_equipe FOR ALL
USING (
  public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  AND public.rdo_status(rdo_id) = ANY (ARRAY['rascunho'::text, 'rejeitado'::text])
)
WITH CHECK (
  public.user_is_rdo_responsavel(auth.uid(), rdo_id)
  AND public.rdo_status(rdo_id) = ANY (ARRAY['rascunho'::text, 'rejeitado'::text])
);
