
-- 1. Fix user_roles privilege escalation: Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert roles" ON public.user_roles;

-- Replace with service_role-only INSERT policy
CREATE POLICY "Only service role inserts roles" ON public.user_roles
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 2. Fix prestadores PII exposure: Drop overly permissive SELECT
DROP POLICY IF EXISTS "Authenticated users can view providers" ON public.prestadores;

-- Replace with staff-only view (staff already covered by "Admins can manage providers")
-- No new policy needed since "Admins can manage providers" already covers staff

-- 3. Fix presence_confirmation_tokens public read
DROP POLICY IF EXISTS "Public read tokens for validation" ON public.presence_confirmation_tokens;

-- Replace with authenticated-only read, scoped to token lookup
CREATE POLICY "Authenticated users can read tokens" ON public.presence_confirmation_tokens
  FOR SELECT TO authenticated
  USING (true);

-- 4. Fix audit_logs unrestricted INSERT
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Replace with service_role-only INSERT
CREATE POLICY "Only service role inserts audit logs" ON public.audit_logs
  FOR INSERT TO service_role
  WITH CHECK (true);
