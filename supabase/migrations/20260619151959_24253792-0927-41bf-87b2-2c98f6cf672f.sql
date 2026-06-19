
-- Helper: is the authenticated user the owner of this cliente?
CREATE OR REPLACE FUNCTION public.is_cliente_owner(_user_id uuid, _cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clientes c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.id = _cliente_id
      AND p.user_id = _user_id
  );
$$;

-- ============ ordens_servico ============
DROP POLICY IF EXISTS "Clients view OS of own tickets" ON public.ordens_servico;
CREATE POLICY "Clients view OS of own tickets"
ON public.ordens_servico
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ordens_servico.ticket_id
      AND public.is_cliente_owner(auth.uid(), t.cliente_id)
  )
);

-- ============ rme_relatorios ============
DROP POLICY IF EXISTS "Clients view RME of own tickets" ON public.rme_relatorios;
CREATE POLICY "Clients view RME of own tickets"
ON public.rme_relatorios
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = rme_relatorios.ticket_id
      AND public.is_cliente_owner(auth.uid(), t.cliente_id)
  )
);

-- ============ rdo_relatorios ============
-- Cliente já vê RDOs aprovadas; agora deixa ver TODAS as RDOs das obras dele.
DROP POLICY IF EXISTS "Cliente views all RDO of own obra" ON public.rdo_relatorios;
CREATE POLICY "Cliente views all RDO of own obra"
ON public.rdo_relatorios
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND public.user_owns_obra(auth.uid(), obra_id)
);

-- ============ tickets (UPDATE pelo próprio cliente) ============
DROP POLICY IF EXISTS "Clients update own open tickets" ON public.tickets;
CREATE POLICY "Clients update own open tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND created_by = auth.uid()
  AND status::text IN ('aberto', 'aguardando_aprovacao', 'cancelado')
)
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND created_by = auth.uid()
  AND status::text IN ('aberto', 'aguardando_aprovacao', 'cancelado')
);
