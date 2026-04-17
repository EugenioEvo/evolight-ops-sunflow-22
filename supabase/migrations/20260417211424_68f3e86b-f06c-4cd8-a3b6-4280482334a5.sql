
-- Remove old CHECK constraint blocking new values
ALTER TABLE public.rme_relatorios DROP CONSTRAINT IF EXISTS rme_relatorios_status_check;

-- 1) Backfill
UPDATE public.rme_relatorios
SET status = CASE
  WHEN status_aprovacao = 'aprovado' THEN 'aprovado'
  WHEN status_aprovacao = 'rejeitado' THEN 'rejeitado'
  WHEN status = 'concluido' AND status_aprovacao = 'pendente' THEN 'pendente'
  WHEN status IS NULL OR status = '' THEN 'rascunho'
  ELSE 'rascunho'
END;

-- 2) RLS técnicos
DROP POLICY IF EXISTS "Technicians can update their own pending RME reports" ON public.rme_relatorios;

CREATE POLICY "Technicians can update their own draft RME reports"
ON public.rme_relatorios
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id
      AND p.user_id = auth.uid()
      AND rme_relatorios.status IN ('rascunho', 'rejeitado')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id
      AND p.user_id = auth.uid()
      AND rme_relatorios.status IN ('rascunho', 'pendente', 'rejeitado')
  )
);

-- 3) Trigger de notificação reescrito
DROP TRIGGER IF EXISTS trigger_notify_rme_status ON public.rme_relatorios;

CREATE OR REPLACE FUNCTION public.notify_rme_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tecnico_user_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT p.user_id INTO v_tecnico_user_id
  FROM tecnicos t
  JOIN profiles p ON p.id = t.profile_id
  WHERE t.id = NEW.tecnico_id;

  IF v_tecnico_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'aprovado' THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (v_tecnico_user_id, 'rme_aprovado', 'RME Aprovado',
            'Seu relatório de manutenção foi aprovado!', '/gerenciar-rme');
  ELSIF NEW.status = 'rejeitado' THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (v_tecnico_user_id, 'rme_rejeitado', 'RME Rejeitado',
            'Seu relatório de manutenção foi rejeitado. Revise e reenvie.',
            '/rme?os=' || NEW.ordem_servico_id::text);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_notify_rme_status
AFTER UPDATE ON public.rme_relatorios
FOR EACH ROW
EXECUTE FUNCTION public.notify_rme_status_change();

-- 4) Checklist policy
DROP POLICY IF EXISTS "Technicians can update their own checklist items" ON public.rme_checklist_items;

CREATE POLICY "Technicians can update their own checklist items"
ON public.rme_checklist_items
FOR UPDATE
USING (
  is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM rme_relatorios r
    JOIN tecnicos t ON t.id = r.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE r.id = rme_checklist_items.rme_id
      AND p.user_id = auth.uid()
      AND r.status IN ('rascunho', 'rejeitado')
  )
)
WITH CHECK (
  is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM rme_relatorios r
    JOIN tecnicos t ON t.id = r.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE r.id = rme_checklist_items.rme_id
      AND p.user_id = auth.uid()
      AND r.status IN ('rascunho', 'rejeitado')
  )
);

-- 5) OS completion validation
CREATE OR REPLACE FUNCTION public.validate_os_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rme_status text;
  v_ticket_status text;
BEGIN
  SELECT status INTO v_ticket_status FROM tickets WHERE id = NEW.ticket_id;

  IF v_ticket_status = 'concluido' AND OLD.ticket_id = NEW.ticket_id THEN
    SELECT status INTO v_rme_status FROM rme_relatorios WHERE ordem_servico_id = NEW.id;

    IF v_rme_status IS NULL OR v_rme_status != 'aprovado' THEN
      RAISE EXCEPTION 'Não é possível concluir a OS sem um RME aprovado vinculado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 6) Defaults & NOT NULL
ALTER TABLE public.rme_relatorios
  ALTER COLUMN status SET DEFAULT 'rascunho',
  ALTER COLUMN status SET NOT NULL;

-- 7) Drop redundant column
ALTER TABLE public.rme_relatorios DROP COLUMN IF EXISTS status_aprovacao;

-- 8) New CHECK
ALTER TABLE public.rme_relatorios
  ADD CONSTRAINT rme_relatorios_status_check
  CHECK (status IN ('rascunho', 'pendente', 'aprovado', 'rejeitado'));
