-- Remove the remaining policies that reference user_metadata
DROP POLICY IF EXISTS "Admins/Área Técnica podem inserir perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins/Área Técnica podem atualizar perfis" ON public.profiles;

-- The existing policies should be sufficient:
-- "Profiles select policy" - allows own profile and admin/area_tecnica viewing
-- "Profiles insert policy" - allows own profile creation
-- "Profiles update policy" - allows own profile and admin/area_tecnica updates  
-- "Profiles delete policy" - allows admin/area_tecnica deletion

-- For admin functionality, they need to be able to insert profiles for new clients
-- Let's update the insert policy to be more permissive for user creation
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;

CREATE POLICY "Profiles insert policy"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);