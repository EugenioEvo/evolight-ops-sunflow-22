
-- Remover políticas existentes que causam recursão
DROP POLICY IF EXISTS "Usuários podem visualizar clientes relacionados" ON clientes;
DROP POLICY IF EXISTS "Usuários podem inserir clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários podem atualizar clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários podem deletar clientes" ON clientes;
DROP POLICY IF EXISTS "Admin pode visualizar todos clientes" ON clientes;
DROP POLICY IF EXISTS "Admin pode inserir clientes" ON clientes;
DROP POLICY IF EXISTS "Admin pode atualizar clientes" ON clientes;
DROP POLICY IF EXISTS "Admin pode deletar clientes" ON clientes;

-- Criar políticas usando as funções SECURITY DEFINER existentes
CREATE POLICY "Admin tem acesso total aos clientes"
ON clientes
FOR ALL
TO authenticated
USING (public.is_admin_safe());

CREATE POLICY "Área técnica tem acesso total aos clientes"
ON clientes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'area_tecnica'::app_role
  )
);

CREATE POLICY "Clientes podem ver seus próprios dados"
ON clientes
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);
