
-- Storage RLS for hse-certificacoes bucket
-- Path convention: <cert_id>/<file>
CREATE POLICY "hse anexos read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'hse-certificacoes'
    AND EXISTS (
      SELECT 1 FROM public.hse_certificacoes c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (
          public.is_staff_or_backoffice(auth.uid())
          OR public.hse_cert_is_owner(auth.uid(), c.profile_id, c.prestador_id)
        )
    )
  );

CREATE POLICY "hse anexos write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hse-certificacoes'
    AND EXISTS (
      SELECT 1 FROM public.hse_certificacoes c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (
          public.is_staff_or_backoffice(auth.uid())
          OR public.hse_cert_is_owner(auth.uid(), c.profile_id, c.prestador_id)
        )
    )
  );

CREATE POLICY "hse anexos delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'hse-certificacoes'
    AND EXISTS (
      SELECT 1 FROM public.hse_certificacoes c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (
          public.is_staff_or_backoffice(auth.uid())
          OR public.hse_cert_is_owner(auth.uid(), c.profile_id, c.prestador_id)
        )
    )
  );
