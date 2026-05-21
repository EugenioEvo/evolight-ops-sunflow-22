
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS midias jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('insumo-midias', 'insumo-midias', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "insumo_midias_select_auth" ON storage.objects;
CREATE POLICY "insumo_midias_select_auth"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'insumo-midias');

DROP POLICY IF EXISTS "insumo_midias_write_staff" ON storage.objects;
CREATE POLICY "insumo_midias_write_staff"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'insumo-midias' AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'supervisao'::app_role) OR
    public.has_role(auth.uid(), 'engenharia'::app_role) OR
    public.has_role(auth.uid(), 'backoffice'::app_role)
  )
);

DROP POLICY IF EXISTS "insumo_midias_update_staff" ON storage.objects;
CREATE POLICY "insumo_midias_update_staff"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'insumo-midias' AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'supervisao'::app_role) OR
    public.has_role(auth.uid(), 'engenharia'::app_role) OR
    public.has_role(auth.uid(), 'backoffice'::app_role)
  )
);

DROP POLICY IF EXISTS "insumo_midias_delete_staff" ON storage.objects;
CREATE POLICY "insumo_midias_delete_staff"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'insumo-midias' AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'supervisao'::app_role) OR
    public.has_role(auth.uid(), 'engenharia'::app_role) OR
    public.has_role(auth.uid(), 'backoffice'::app_role)
  )
);
