
-- Expandir políticas do bucket rdo-evidences para incluir lider_eletromecanico e eletromecanico
DROP POLICY IF EXISTS "Sup eletromec upload rdo evidences" ON storage.objects;
DROP POLICY IF EXISTS "Eletromec read rdo evidences" ON storage.objects;
DROP POLICY IF EXISTS "Staff/sup delete rdo evidences" ON storage.objects;

CREATE POLICY "Eletromec upload rdo evidences"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rdo-evidences'
  AND (
    public.is_staff(auth.uid())
    OR public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'eletromecanico'::app_role)
  )
);

CREATE POLICY "Eletromec read rdo evidences"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rdo-evidences'
  AND (
    public.is_staff(auth.uid())
    OR public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'eletromecanico'::app_role)
  )
);

CREATE POLICY "Eletromec delete rdo evidences"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rdo-evidences'
  AND (
    public.is_staff(auth.uid())
    OR public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'eletromecanico'::app_role)
  )
);
