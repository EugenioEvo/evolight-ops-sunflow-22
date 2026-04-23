-- 1) Trigger no rme_relatorios: garante que ticket_id sempre bate com o ticket da OS vinculada.
-- Cobre INSERT (caso o cliente envie ticket_id errado) e UPDATE de ordem_servico_id.
CREATE OR REPLACE FUNCTION public.sync_rme_ticket_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  SELECT ticket_id INTO v_ticket_id
  FROM public.ordens_servico
  WHERE id = NEW.ordem_servico_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'OS % não encontrada ao sincronizar ticket_id do RME', NEW.ordem_servico_id;
  END IF;

  -- Sempre força o ticket correto, ignorando valor enviado pelo cliente.
  NEW.ticket_id := v_ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rme_ticket_id ON public.rme_relatorios;
CREATE TRIGGER trg_sync_rme_ticket_id
BEFORE INSERT OR UPDATE OF ordem_servico_id, ticket_id
ON public.rme_relatorios
FOR EACH ROW
EXECUTE FUNCTION public.sync_rme_ticket_id();

-- 2) Trigger no ordens_servico: se o ticket_id de uma OS mudar (cenário raro de remapeamento),
-- propaga a mudança para o RME vinculado, mantendo a denormalização consistente.
CREATE OR REPLACE FUNCTION public.propagate_os_ticket_change_to_rme()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.ticket_id IS DISTINCT FROM NEW.ticket_id THEN
    UPDATE public.rme_relatorios
       SET ticket_id = NEW.ticket_id,
           updated_at = now()
     WHERE ordem_servico_id = NEW.id
       AND ticket_id IS DISTINCT FROM NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_os_ticket_change_to_rme ON public.ordens_servico;
CREATE TRIGGER trg_propagate_os_ticket_change_to_rme
AFTER UPDATE OF ticket_id ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.propagate_os_ticket_change_to_rme();

-- 3) Saneamento retroativo: corrige RMEs cujo ticket_id divergiu do ticket da OS.
UPDATE public.rme_relatorios r
   SET ticket_id = os.ticket_id,
       updated_at = now()
  FROM public.ordens_servico os
 WHERE os.id = r.ordem_servico_id
   AND r.ticket_id IS DISTINCT FROM os.ticket_id;