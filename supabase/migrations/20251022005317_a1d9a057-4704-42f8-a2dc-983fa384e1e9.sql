-- Permitir técnicos de campo atualizarem tickets vinculados às suas OS
CREATE POLICY "Technicians can update their assigned tickets"
ON public.tickets
FOR UPDATE
TO authenticated
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
)
WITH CHECK (
  has_role(auth.uid(), 'tecnico_campo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id
      AND p.user_id = auth.uid()
  )
  AND tickets.status IN ('em_execucao', 'concluido')
);