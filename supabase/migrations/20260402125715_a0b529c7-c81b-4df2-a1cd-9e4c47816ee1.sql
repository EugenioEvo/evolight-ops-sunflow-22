
-- Add aceite_tecnico column to tickets for two-step acceptance on reassignment
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS aceite_tecnico text NOT NULL DEFAULT 'nao_aplicavel';

-- Allow technicians to update aceite_tecnico on their assigned tickets
CREATE POLICY "Technicians can update aceite on assigned tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  EXISTS (
    SELECT 1 FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  EXISTS (
    SELECT 1 FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id AND p.user_id = auth.uid()
  )
);
