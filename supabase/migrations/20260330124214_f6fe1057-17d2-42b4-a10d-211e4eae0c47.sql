
-- Fix 1: presence_confirmation_attempts - restrict public policies to service_role
DROP POLICY IF EXISTS "Public read for validation" ON public.presence_confirmation_attempts;
DROP POLICY IF EXISTS "System can delete old attempts" ON public.presence_confirmation_attempts;
DROP POLICY IF EXISTS "System can log attempts" ON public.presence_confirmation_attempts;

CREATE POLICY "Service role manages attempts"
  ON public.presence_confirmation_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 2: status_historico - restrict "System insert history" to service_role
DROP POLICY IF EXISTS "System insert history" ON public.status_historico;
CREATE POLICY "Service role inserts history"
  ON public.status_historico
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also allow authenticated staff/technicians to insert (for trigger context via auth.uid())
CREATE POLICY "Authenticated users insert history"
  ON public.status_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role) OR has_role(auth.uid(), 'cliente'::app_role));

-- Fix 3: notificacoes - restrict "System can insert notifications" to service_role
DROP POLICY IF EXISTS "System can insert notifications" ON public.notificacoes;
CREATE POLICY "Service role inserts notifications"
  ON public.notificacoes
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix 4: rme-evidences storage - restrict to staff and technicians only
DROP POLICY IF EXISTS "Authenticated users can upload evidences" ON storage.objects;
DROP POLICY IF EXISTS "Users can view evidences" ON storage.objects;

CREATE POLICY "Staff and technicians can upload evidences"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'rme-evidences' AND
    (is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role))
  );

CREATE POLICY "Staff and technicians can view evidences"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'rme-evidences' AND
    (is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role))
  );

-- Fix 5: clientes - restrict "System insert clients" to service_role
DROP POLICY IF EXISTS "System insert clients" ON public.clientes;
CREATE POLICY "Service role inserts clients"
  ON public.clientes
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated clients to insert their own client record
CREATE POLICY "Authenticated users insert own client"
  ON public.clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_staff(auth.uid()) OR
    (has_role(auth.uid(), 'cliente'::app_role) AND profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
  );
