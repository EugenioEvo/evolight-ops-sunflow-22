-- Criar trigger para notificar técnico ao criar OS
CREATE TRIGGER trg_notify_os_atribuida
AFTER INSERT ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.notify_os_atribuida();

-- Backfill: Corrigir tecnico_id nas OS existentes
UPDATE public.ordens_servico os
SET tecnico_id = tec.id
FROM public.tickets t
JOIN public.prestadores pr ON pr.id = t.tecnico_responsavel_id
JOIN public.profiles p ON p.email = pr.email
JOIN public.tecnicos tec ON tec.profile_id = p.id
WHERE os.ticket_id = t.id
  AND (os.tecnico_id IS DISTINCT FROM tec.id);