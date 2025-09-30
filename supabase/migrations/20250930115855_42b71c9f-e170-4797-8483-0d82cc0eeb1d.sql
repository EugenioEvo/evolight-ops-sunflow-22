-- Fix infinite recursion in profiles policies
-- First, drop the problematic policy
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;

-- Create a security definer function to check admin role safely
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = _user_id AND role = 'admin'::user_role
  );
$$;

-- Create a new, safer admin policy for profiles
CREATE POLICY "Admins podem ver todos os perfis v2" 
ON public.profiles 
FOR SELECT 
USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

-- Update other problematic policies for clientes
DROP POLICY IF EXISTS "Admins e área técnica podem ver todos os clientes" ON public.clientes;

CREATE POLICY "Admins e área técnica podem ver todos os clientes v2" 
ON public.clientes 
FOR SELECT 
USING (
  public.is_admin(auth.uid()) OR 
  public.get_user_role(auth.uid()) = 'area_tecnica'::user_role OR
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.id = clientes.profile_id AND p.user_id = auth.uid()
  )
);

-- Update the clientes management policy
DROP POLICY IF EXISTS "Clientes podem ver seu próprio perfil" ON public.clientes;

CREATE POLICY "Admins e área técnica podem gerenciar clientes" 
ON public.clientes 
FOR ALL
USING (
  public.is_admin(auth.uid()) OR 
  public.get_user_role(auth.uid()) = 'area_tecnica'::user_role OR
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.id = clientes.profile_id AND p.user_id = auth.uid()
  )
);

-- Also update tecnicos policies to prevent similar issues
DROP POLICY IF EXISTS "Admins e área técnica podem ver todos os técnicos" ON public.tecnicos;

CREATE POLICY "Admins e área técnica podem ver todos os técnicos v2" 
ON public.tecnicos 
FOR SELECT 
USING (
  public.is_admin(auth.uid()) OR 
  public.get_user_role(auth.uid()) = 'area_tecnica'::user_role OR
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.id = tecnicos.profile_id AND p.user_id = auth.uid()
  )
);