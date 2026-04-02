
-- Drop old policies on rme-fotos that use area_tecnica
DROP POLICY IF EXISTS "Técnicos podem fazer upload de fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos podem visualizar fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos podem atualizar fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos podem deletar fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos podem gerenciar fotos RME" ON storage.objects;

-- Recreate with is_staff() for rme-fotos
CREATE POLICY "Staff and technicians can view rme-fotos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rme-fotos' AND (
    is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

CREATE POLICY "Staff and technicians can upload rme-fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rme-fotos' AND (
    is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

CREATE POLICY "Staff and technicians can update rme-fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'rme-fotos' AND (
    is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'rme-fotos' AND (
    is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

CREATE POLICY "Staff and technicians can delete rme-fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rme-fotos' AND (
    is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

-- Also fix ordens-servico view policy (uses area_tecnica)
DROP POLICY IF EXISTS "Usuários podem ver PDFs de suas OS" ON storage.objects;
CREATE POLICY "Staff and technicians can view OS PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ordens-servico' AND (
    is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

-- Fix ticket-anexos view (uses area_tecnica)
DROP POLICY IF EXISTS "Usuários podem ver anexos de seus tickets" ON storage.objects;
