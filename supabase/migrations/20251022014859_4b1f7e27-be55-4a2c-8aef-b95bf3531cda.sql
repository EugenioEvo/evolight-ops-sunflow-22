-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Clients can view their own tickets" ON public.tickets;

-- Create new restricted policies
CREATE POLICY "Clients can view their own tickets"
ON public.tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM clientes c
    JOIN profiles p ON p.id = c.profile_id
    WHERE c.id = tickets.cliente_id 
    AND p.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Technicians can view their assigned tickets"
ON public.tickets
FOR SELECT
USING (
  has_role(auth.uid(), 'tecnico_campo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id
    AND p.user_id = auth.uid()
  )
);