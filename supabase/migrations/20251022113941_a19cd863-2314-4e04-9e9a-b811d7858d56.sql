-- Corrigir RLS policies para bucket rme-fotos

-- Remover policies antigas
DROP POLICY IF EXISTS "Técnicos podem fazer upload de fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos podem visualizar suas fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Administradores podem visualizar todas as fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos upload RME" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos view RME" ON storage.objects;
DROP POLICY IF EXISTS "Admin view RME" ON storage.objects;

-- Permitir técnicos fazerem upload (INSERT) no bucket rme-fotos
CREATE POLICY "Técnicos podem fazer upload de fotos RME" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rme-fotos' AND
  (
    public.has_role(auth.uid(), 'tecnico_campo'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'area_tecnica'::app_role)
  )
);

-- Permitir técnicos visualizarem suas próprias fotos (SELECT)
CREATE POLICY "Técnicos podem visualizar fotos RME" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'rme-fotos' AND
  (
    public.has_role(auth.uid(), 'tecnico_campo'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'area_tecnica'::app_role)
  )
);

-- Permitir técnicos atualizarem suas fotos (UPDATE)
CREATE POLICY "Técnicos podem atualizar fotos RME" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'rme-fotos' AND
  (
    public.has_role(auth.uid(), 'tecnico_campo'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'area_tecnica'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'rme-fotos' AND
  (
    public.has_role(auth.uid(), 'tecnico_campo'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'area_tecnica'::app_role)
  )
);

-- Permitir técnicos e admin deletarem fotos (DELETE)
CREATE POLICY "Técnicos podem deletar fotos RME" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'rme-fotos' AND
  (
    public.has_role(auth.uid(), 'tecnico_campo'::app_role) OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'area_tecnica'::app_role)
  )
);