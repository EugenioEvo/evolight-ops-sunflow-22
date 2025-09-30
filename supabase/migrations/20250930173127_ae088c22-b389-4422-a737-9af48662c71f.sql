-- Limpar políticas duplicadas de INSERT em profiles
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy unified" ON public.profiles;

-- Criar política de INSERT única e clara
CREATE POLICY "profiles_insert_policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Próprio usuário pode criar seu perfil
  auth.uid() = user_id 
  OR 
  -- Admin/área técnica podem criar perfis para outros usuários
  get_user_role(auth.uid()) IN ('admin', 'area_tecnica')
);