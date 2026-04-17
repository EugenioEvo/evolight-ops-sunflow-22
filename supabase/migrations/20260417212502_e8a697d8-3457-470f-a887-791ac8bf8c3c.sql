-- Trigger: when an RME is approved, auto-complete the linked ticket (which represents the OS lifecycle)
CREATE OR REPLACE FUNCTION public.auto_complete_ticket_on_rme_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
  v_current_status text;
BEGIN
  -- Only act on transitions INTO 'aprovado'
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT ticket_id INTO v_ticket_id
    FROM public.ordens_servico
    WHERE id = NEW.ordem_servico_id;

    IF v_ticket_id IS NOT NULL THEN
      SELECT status::text INTO v_current_status FROM public.tickets WHERE id = v_ticket_id;

      -- Only auto-complete if not already concluded/cancelled
      IF v_current_status IS NOT NULL AND v_current_status NOT IN ('concluido', 'cancelado') THEN
        UPDATE public.tickets
        SET status = 'concluido'::ticket_status,
            data_conclusao = now(),
            updated_at = now()
        WHERE id = v_ticket_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_complete_ticket_on_rme_approval ON public.rme_relatorios;

CREATE TRIGGER trg_auto_complete_ticket_on_rme_approval
AFTER UPDATE OF status ON public.rme_relatorios
FOR EACH ROW
EXECUTE FUNCTION public.auto_complete_ticket_on_rme_approval();