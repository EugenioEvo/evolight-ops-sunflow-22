-- Migrar roles da tabela profiles para user_roles
INSERT INTO user_roles (user_id, role)
SELECT user_id, 
  CASE 
    WHEN role::text = 'admin' THEN 'admin'::app_role
    WHEN role::text = 'area_tecnica' THEN 'area_tecnica'::app_role
    WHEN role::text = 'tecnico_campo' THEN 'tecnico_campo'::app_role
    WHEN role::text = 'cliente' THEN 'cliente'::app_role
  END
FROM profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Recriar as policies de storage para usar user_roles ao invés de profiles.role
DROP POLICY IF EXISTS "Usuários podem ver anexos de seus tickets" ON storage.objects;
DROP POLICY IF EXISTS "Técnicos podem gerenciar fotos RME" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem ver PDFs de suas OS" ON storage.objects;

-- Recriar as policies usando has_role
CREATE POLICY "Usuários podem ver anexos de seus tickets" ON storage.objects
FOR SELECT USING (
  bucket_id = 'tickets' AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'area_tecnica'::app_role)
  )
);

CREATE POLICY "Técnicos podem gerenciar fotos RME" ON storage.objects
FOR ALL USING (
  bucket_id = 'rme-photos' AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'area_tecnica'::app_role) OR 
    has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

CREATE POLICY "Usuários podem ver PDFs de suas OS" ON storage.objects
FOR SELECT USING (
  bucket_id = 'ordens-servico' AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'area_tecnica'::app_role) OR 
    has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

-- Remover o trigger que depende da coluna role
DROP TRIGGER IF EXISTS trigger_criar_tecnico ON profiles;

-- Remover a coluna role da tabela profiles
ALTER TABLE profiles DROP COLUMN role;