
-- 1. Scope presence_confirmation_tokens SELECT to involved parties only
DROP POLICY IF EXISTS "Authenticated users can read tokens" ON public.presence_confirmation_tokens;

CREATE POLICY "Only involved parties can read tokens"
  ON public.presence_confirmation_tokens FOR SELECT
  TO authenticated
  USING (
    is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM ordens_servico os
      JOIN tecnicos t ON t.id = os.tecnico_id
      JOIN profiles p ON p.id = t.profile_id
      WHERE os.id = presence_confirmation_tokens.ordem_servico_id
        AND p.user_id = auth.uid()
    )
  );

-- 2. Restrict tecnicos INSERT to service_role only (remove public INSERT)
DROP POLICY IF EXISTS "System can insert technicians" ON public.tecnicos;

CREATE POLICY "Only service role inserts technicians"
  ON public.tecnicos FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also allow staff to insert technicians
CREATE POLICY "Staff can insert technicians"
  ON public.tecnicos FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- 3. Fix storage: restrict ordens-servico bucket uploads to staff only
DROP POLICY IF EXISTS "Sistema pode criar PDFs de OS" ON storage.objects;

CREATE POLICY "Staff can upload OS PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ordens-servico'
    AND is_staff(auth.uid())
  );

-- Also allow service_role for system-generated PDFs
CREATE POLICY "Service role creates OS PDFs"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'ordens-servico');
