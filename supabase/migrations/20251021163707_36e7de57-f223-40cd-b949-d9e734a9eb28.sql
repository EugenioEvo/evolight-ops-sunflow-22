-- Corrigir recursão infinita em RLS user_roles

-- 1. Criar função segura para verificar se é admin (já existe is_admin, vamos melhorar)
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
    LIMIT 1
  ) INTO v_is_admin;
  
  RETURN v_is_admin;
END;
$$;

-- 2. Remover política recursiva e recriar com função segura
DROP POLICY IF EXISTS "Only admins can manage roles" ON user_roles;

CREATE POLICY "Only admins can manage roles"
ON user_roles
FOR ALL
TO authenticated
USING (public.is_admin_safe())
WITH CHECK (public.is_admin_safe());