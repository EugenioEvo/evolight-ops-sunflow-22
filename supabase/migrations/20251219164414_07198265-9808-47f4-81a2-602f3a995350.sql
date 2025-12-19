-- Remove the overly permissive "System can manage geocoding cache" policy
DROP POLICY IF EXISTS "System can manage geocoding cache" ON public.geocoding_cache;

-- Create a new policy that only allows service role operations (for edge functions)
-- The service role bypasses RLS, so edge functions will still work
-- For authenticated users, only admin and area_tecnica can access

-- Ensure only admins/area_tecnica can SELECT from geocoding_cache
DROP POLICY IF EXISTS "Admins can manage geocoding cache" ON public.geocoding_cache;

CREATE POLICY "Admins and area_tecnica can view geocoding cache" 
ON public.geocoding_cache 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Admins and area_tecnica can insert geocoding cache" 
ON public.geocoding_cache 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Admins and area_tecnica can update geocoding cache" 
ON public.geocoding_cache 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Admins and area_tecnica can delete geocoding cache" 
ON public.geocoding_cache 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);