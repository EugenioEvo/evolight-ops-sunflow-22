-- Configurar RLS para bucket ticket-anexos
CREATE POLICY "Admins e técnicos podem fazer upload de anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-anexos' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'area_tecnica'::app_role)
    OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

CREATE POLICY "Admins e técnicos podem visualizar anexos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-anexos'
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'area_tecnica'::app_role)
    OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

CREATE POLICY "Admins podem deletar anexos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-anexos'
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'area_tecnica'::app_role)
  )
);

-- Atualizar bucket para privado
UPDATE storage.buckets 
SET public = false 
WHERE id = 'ticket-anexos';