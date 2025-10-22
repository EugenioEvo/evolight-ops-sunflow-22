-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Clients can view their own data" ON public.clientes;

-- Clients can view their own data
CREATE POLICY "Clients can view their own data"
ON public.clientes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = clientes.profile_id 
    AND p.user_id = auth.uid()
  )
);

-- Admins can view all clients
CREATE POLICY "Admins can view all clients"
ON public.clientes
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Technical area can only view clients with active tickets
CREATE POLICY "Technical area can view clients with tickets"
ON public.clientes
FOR SELECT
USING (
  has_role(auth.uid(), 'area_tecnica'::app_role)
  AND EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.cliente_id = clientes.id
  )
);

-- Technicians can only view clients for their assigned tickets
CREATE POLICY "Technicians can view assigned clients"
ON public.clientes
FOR SELECT
USING (
  has_role(auth.uid(), 'tecnico_campo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM tickets t
    JOIN ordens_servico os ON os.ticket_id = t.id
    JOIN tecnicos tec ON tec.id = os.tecnico_id
    JOIN profiles p ON p.id = tec.profile_id
    WHERE t.cliente_id = clientes.id
    AND p.user_id = auth.uid()
  )
);