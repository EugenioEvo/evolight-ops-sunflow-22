-- Drop all problematic policies that reference user_metadata
DROP POLICY IF EXISTS "Perfis - visualizar" ON public.profiles;
DROP POLICY IF EXISTS "Perfis - inserir" ON public.profiles;
DROP POLICY IF EXISTS "Perfis - atualizar" ON public.profiles;
DROP POLICY IF EXISTS "Perfis - excluir" ON public.profiles;

-- Create simple, secure policies that rely only on the profiles table itself
CREATE POLICY "Profiles select policy"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id OR 
  role IN ('admin', 'area_tecnica')
);

CREATE POLICY "Profiles insert policy"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Profiles update policy"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role IN ('admin', 'area_tecnica')
  )
)
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Profiles delete policy"
ON public.profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role IN ('admin', 'area_tecnica')
  )
);