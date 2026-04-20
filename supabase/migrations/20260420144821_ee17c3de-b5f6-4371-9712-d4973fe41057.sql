-- Reverter trigger e função sync_os_aceite_on_ticket_progress.
-- Motivo: OS recusadas devem permanecer no histórico como recusadas.
-- O fluxo correto exige que staff aloque outro técnico (nova OS), não que reaproveite a recusada.
DROP TRIGGER IF EXISTS trg_sync_os_aceite_on_ticket_progress ON public.tickets;
DROP FUNCTION IF EXISTS public.sync_os_aceite_on_ticket_progress();