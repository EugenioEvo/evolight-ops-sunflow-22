
-- Helper SECURITY DEFINER que bypassa RLS para quebrar a recursão
CREATE OR REPLACE FUNCTION public.is_ticket_owner_cliente(_user_id uuid, _ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tickets t
    JOIN public.clientes c ON c.id = t.cliente_id
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE t.id = _ticket_id
      AND p.user_id = _user_id
  );
$$;

-- Recriar policies sem subquery direta em tickets (que causava recursão com a policy de técnicos)
DROP POLICY IF EXISTS "Clients view OS of own tickets" ON public.ordens_servico;
CREATE POLICY "Clients view OS of own tickets"
ON public.ordens_servico
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND public.is_ticket_owner_cliente(auth.uid(), ticket_id)
);

DROP POLICY IF EXISTS "Clients view RME of own tickets" ON public.rme_relatorios;
CREATE POLICY "Clients view RME of own tickets"
ON public.rme_relatorios
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND ticket_id IS NOT NULL
  AND public.is_ticket_owner_cliente(auth.uid(), ticket_id)
);
