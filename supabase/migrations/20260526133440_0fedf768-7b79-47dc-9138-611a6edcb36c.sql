
-- 1) Restrict insumo-midias bucket SELECT to staff/backoffice/tecnico_campo only
DROP POLICY IF EXISTS "insumo_midias_select_auth" ON storage.objects;
CREATE POLICY "insumo_midias_select_staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'insumo-midias'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisao'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
    OR public.has_role(auth.uid(), 'backoffice'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

-- 2) Tighten ticket-anexos upload for tecnico_campo: must upload under their own user folder
DROP POLICY IF EXISTS "Admins e técnicos podem fazer upload de anexos" ON storage.objects;
CREATE POLICY "Staff e técnicos podem fazer upload de anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-anexos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'area_tecnica'::app_role)
    OR (
      public.has_role(auth.uid(), 'tecnico_campo'::app_role)
      AND (auth.uid())::text = (storage.foldername(name))[1]
    )
  )
);
