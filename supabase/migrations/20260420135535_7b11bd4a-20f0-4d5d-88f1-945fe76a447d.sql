-- Trigger para impedir incoerência: ticket avançou no fluxo (em_execucao/aguardando_rme/concluido)
-- mas a OS vinculada continuou com aceite_tecnico='recusado'.
-- Quando isso acontecer, normalizamos a OS para 'aceito' (ticket só chega nesses estados via ação operacional).
CREATE OR REPLACE FUNCTION public.sync_os_aceite_on_ticket_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('em_execucao', 'aguardando_rme', 'concluido')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.ordens_servico
       SET aceite_tecnico = 'aceito',
           motivo_recusa = NULL,
           updated_at = now()
     WHERE ticket_id = NEW.id
       AND aceite_tecnico = 'recusado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_os_aceite_on_ticket_progress ON public.tickets;
CREATE TRIGGER trg_sync_os_aceite_on_ticket_progress
AFTER UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.sync_os_aceite_on_ticket_progress();