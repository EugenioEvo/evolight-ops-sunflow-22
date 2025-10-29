-- Fix RLS policy for technicians to allow starting execution
-- Técnicos devem poder atualizar status de 'ordem_servico_gerada' para 'em_execucao'

DROP POLICY IF EXISTS "Technicians update assigned tickets" ON public.tickets;

CREATE POLICY "Technicians update assigned tickets"
ON public.tickets
FOR UPDATE
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
  AND status IN ('ordem_servico_gerada', 'em_execucao', 'concluido')
  AND EXISTS (
    SELECT 1
    FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id
      AND p.user_id = auth.uid()
  )
);