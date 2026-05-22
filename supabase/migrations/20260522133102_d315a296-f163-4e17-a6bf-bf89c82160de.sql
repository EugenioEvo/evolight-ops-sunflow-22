
-- Helper: pode aprovar RDO (admin, engenharia, sup_eletromecanico)
CREATE OR REPLACE FUNCTION public.can_approve_rdo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'engenharia'::app_role, 'sup_eletromecanico'::app_role)
  );
$$;

-- Permitir líder eletromecânico criar RDO (mesmas regras de sup_eletromecanico)
DROP POLICY IF EXISTS "Lider eletromec creates own RDO" ON public.rdo_relatorios;
CREATE POLICY "Lider eletromec creates own RDO" ON public.rdo_relatorios
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
    AND public.user_is_prestador(auth.uid(), responsavel_id)
  );

DROP POLICY IF EXISTS "Lider eletromec updates own RDO drafts" ON public.rdo_relatorios;
CREATE POLICY "Lider eletromec updates own RDO drafts" ON public.rdo_relatorios
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
    AND public.user_is_prestador(auth.uid(), responsavel_id)
    AND status IN ('rascunho','rejeitado')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
    AND public.user_is_prestador(auth.uid(), responsavel_id)
    AND status IN ('rascunho','rejeitado','pendente')
  );

-- Permitir sup_eletromecanico aprovar/rejeitar qualquer RDO
DROP POLICY IF EXISTS "Sup eletromec approves RDO" ON public.rdo_relatorios;
CREATE POLICY "Sup eletromec approves RDO" ON public.rdo_relatorios
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
  );

-- Garantir SELECT para sup_eletromecanico e lider_eletromecanico em todos os RDOs
DROP POLICY IF EXISTS "Eletromec staff view all RDO" ON public.rdo_relatorios;
CREATE POLICY "Eletromec staff view all RDO" ON public.rdo_relatorios
  FOR SELECT USING (
    public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
  );

-- Permitir que líder/supervisor eletromecânico gerenciem subitens (equipe/atividades/equipamentos/evidências)
-- via reuso das políticas existentes que usam user_is_prestador na rdo_relatorios.responsavel_id.
-- Adicionais para sup_eletromecanico aprovar -- subitens já são editáveis por staff_or_responsavel; sem mudança.
