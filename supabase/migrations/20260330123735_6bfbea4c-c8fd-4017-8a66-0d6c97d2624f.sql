
-- Fix 1: geocoding_rate_limits - change policy from public to service_role
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.geocoding_rate_limits;
CREATE POLICY "Service role can manage rate limits"
  ON public.geocoding_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 2: profiles - restrict "System can insert profiles" to service_role only
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "Service role inserts profiles"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also allow authenticated users to insert their own profile (for edge cases)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
