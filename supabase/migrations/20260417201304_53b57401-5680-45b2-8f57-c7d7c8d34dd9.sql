-- Bloqueio rígido de OS duplicada por (ticket, técnico):
-- Apenas uma OS ativa (não recusada) por par (ticket_id, tecnico_id).
-- OS recusadas não bloqueiam recriação (técnico pode ser reatribuído).
CREATE UNIQUE INDEX IF NOT EXISTS ordens_servico_ticket_tecnico_active_unique
  ON public.ordens_servico (ticket_id, tecnico_id)
  WHERE tecnico_id IS NOT NULL AND aceite_tecnico <> 'recusado';