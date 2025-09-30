-- First drop all existing policies on profiles to clean up
DROP POLICY IF EXISTS "Admins/Área Técnica podem ver perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver e editar próprio perfil" ON public.profiles;

-- Create comprehensive policies for profiles without recursion
CREATE POLICY "Perfis - visualizar" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'area_tecnica')
);

CREATE POLICY "Perfis - inserir" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR 
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'area_tecnica')
);

CREATE POLICY "Perfis - atualizar" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'area_tecnica')
)
WITH CHECK (
  auth.uid() = user_id OR 
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'area_tecnica')
);

CREATE POLICY "Perfis - excluir" 
ON public.profiles 
FOR DELETE 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'area_tecnica')
);