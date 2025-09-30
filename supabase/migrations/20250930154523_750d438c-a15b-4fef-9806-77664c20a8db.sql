-- Ajustar política de INSERT em profiles para permitir admins criarem perfis de clientes
DROP POLICY IF EXISTS "Usuário pode inserir o próprio perfil" ON public.profiles;

-- Recriar a policy de INSERT unificada
CREATE POLICY "Profiles insert policy unified"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  OR 
  get_user_role(auth.uid()) IN ('admin', 'area_tecnica')
);