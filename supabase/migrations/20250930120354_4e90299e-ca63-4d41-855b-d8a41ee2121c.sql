-- Strengthen and fix RLS on profiles to allow admin/area_tecnica and own-user inserts/updates without recursion

-- Replace SELECT policy to avoid recursion by relying on JWT role claims
DROP POLICY IF EXISTS "Admins podem ver todos os perfis v2" ON public.profiles;
CREATE POLICY "Admins/Área Técnica podem ver perfis"
ON public.profiles
FOR SELECT
USING ((coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') IN ('admin','area_tecnica')) OR auth.uid() = user_id);

-- Allow users to insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Usuário pode inserir o próprio perfil"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow admins/area_tecnica to insert any profile (e.g., ao cadastrar clientes)
DROP POLICY IF EXISTS "Admins podem inserir perfis" ON public.profiles;
CREATE POLICY "Admins/Área Técnica podem inserir perfis"
ON public.profiles
FOR INSERT
WITH CHECK (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') IN ('admin','area_tecnica'));

-- Allow users to update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Usuário pode atualizar o próprio perfil"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow admins/area_tecnica to update any profile
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
CREATE POLICY "Admins/Área Técnica podem atualizar perfis"
ON public.profiles
FOR UPDATE
USING (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') IN ('admin','area_tecnica'))
WITH CHECK (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') IN ('admin','area_tecnica'));
