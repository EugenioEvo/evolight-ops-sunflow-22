-- Helper function: returns true if the obra pertence ao cliente do usuário logado
CREATE OR REPLACE FUNCTION public.user_owns_obra(_user_id uuid, _obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.obras o
    JOIN public.clientes c ON c.id = o.cliente_id
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE o.id = _obra_id
      AND p.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_obra(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_obra(uuid, uuid) TO authenticated;

-- Cliente vê própria obra
DROP POLICY IF EXISTS "Cliente views own obra" ON public.obras;
CREATE POLICY "Cliente views own obra"
ON public.obras
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.id = obras.cliente_id AND p.user_id = auth.uid()
  )
);

-- Cliente vê RDOs aprovados das próprias obras
DROP POLICY IF EXISTS "Cliente views approved RDO of own obra" ON public.rdo_relatorios;
CREATE POLICY "Cliente views approved RDO of own obra"
ON public.rdo_relatorios
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND status = 'aprovado'
  AND public.user_owns_obra(auth.uid(), obra_id)
);

-- Cliente vê atividades dos RDOs aprovados das próprias obras
DROP POLICY IF EXISTS "Cliente views atividades of own approved RDO" ON public.rdo_atividades;
CREATE POLICY "Cliente views atividades of own approved RDO"
ON public.rdo_atividades
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.rdo_relatorios r
    WHERE r.id = rdo_atividades.rdo_id
      AND r.status = 'aprovado'
      AND public.user_owns_obra(auth.uid(), r.obra_id)
  )
);

-- Cliente vê evidências dos RDOs aprovados das próprias obras
DROP POLICY IF EXISTS "Cliente views evidencias of own approved RDO" ON public.rdo_evidencias;
CREATE POLICY "Cliente views evidencias of own approved RDO"
ON public.rdo_evidencias
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.rdo_relatorios r
    WHERE r.id = rdo_evidencias.rdo_id
      AND r.status = 'aprovado'
      AND public.user_owns_obra(auth.uid(), r.obra_id)
  )
);

-- (Equipe NÃO é exposta ao cliente — informação operacional interna.)