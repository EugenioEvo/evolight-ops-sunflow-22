-- ============================================
-- PARTE 1: Criar sistema de roles seguro
-- ============================================

-- Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'area_tecnica', 'tecnico_campo', 'cliente');

-- Criar tabela de roles separada
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver seus próprios roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Política: apenas admins podem inserir/atualizar roles
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
);

-- Política: sistema pode inserir roles (para edge function)
CREATE POLICY "System can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (true);

-- Criar função segura para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Migrar roles existentes de profiles para user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role::text::app_role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================
-- PARTE 2: Atualizar RLS policies
-- ============================================

-- PROFILES: Remover policies antigas e criar novas
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "Usuário pode atualizar o próprio perfil" ON public.profiles;

CREATE POLICY "Users can view their own profile or if admin/area_tecnica"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);

-- CLIENTES: Atualizar policies
DROP POLICY IF EXISTS "Clientes select policy" ON public.clientes;
DROP POLICY IF EXISTS "Clientes insert policy" ON public.clientes;
DROP POLICY IF EXISTS "Clientes update policy" ON public.clientes;
DROP POLICY IF EXISTS "Clientes delete policy" ON public.clientes;

CREATE POLICY "Clients can view their own data"
ON public.clientes
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = clientes.profile_id AND p.user_id = auth.uid()) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "Admins can manage clients"
ON public.clientes
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "System can insert clients"
ON public.clientes
FOR INSERT
WITH CHECK (true);

-- TECNICOS: Atualizar policies
DROP POLICY IF EXISTS "Tecnicos select policy" ON public.tecnicos;
DROP POLICY IF EXISTS "Tecnicos all policy" ON public.tecnicos;

CREATE POLICY "Technicians can view their own data"
ON public.tecnicos
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = tecnicos.profile_id AND p.user_id = auth.uid()) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "Technicians can update their own data"
ON public.tecnicos
FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = tecnicos.profile_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = tecnicos.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Admins can manage technicians"
ON public.tecnicos
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "System can insert technicians"
ON public.tecnicos
FOR INSERT
WITH CHECK (true);

-- TICKETS: Atualizar policies
DROP POLICY IF EXISTS "Clientes veem apenas seus tickets" ON public.tickets;
DROP POLICY IF EXISTS "Clientes podem criar tickets" ON public.tickets;
DROP POLICY IF EXISTS "Área técnica e admins podem gerenciar tickets" ON public.tickets;

CREATE POLICY "Clients can view their own tickets"
ON public.tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clientes c 
    JOIN profiles p ON p.id = c.profile_id 
    WHERE c.id = tickets.cliente_id AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica') OR
  public.has_role(auth.uid(), 'tecnico_campo')
);

CREATE POLICY "Clients can create tickets"
ON public.tickets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clientes c 
    JOIN profiles p ON p.id = c.profile_id 
    WHERE c.id = tickets.cliente_id AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "Admins and area_tecnica can manage tickets"
ON public.tickets
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

-- EQUIPAMENTOS: Atualizar policies
DROP POLICY IF EXISTS "Equipamentos select policy" ON public.equipamentos;
DROP POLICY IF EXISTS "Equipamentos all policy" ON public.equipamentos;

CREATE POLICY "Clients can view their own equipment"
ON public.equipamentos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clientes c 
    JOIN profiles p ON p.id = c.profile_id 
    WHERE c.id = equipamentos.cliente_id AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "Admins can manage equipment"
ON public.equipamentos
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

-- APROVACOES: Atualizar policies
DROP POLICY IF EXISTS "Usuários podem ver aprovações de seus tickets" ON public.aprovacoes;
DROP POLICY IF EXISTS "Área técnica pode gerenciar aprovações" ON public.aprovacoes;

CREATE POLICY "Users can view approvals for their tickets"
ON public.aprovacoes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN clientes c ON c.id = t.cliente_id
    JOIN profiles p ON p.id = c.profile_id
    WHERE t.id = aprovacoes.ticket_id AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica') OR
  public.has_role(auth.uid(), 'tecnico_campo')
);

CREATE POLICY "Admins can manage approvals"
ON public.aprovacoes
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

-- STATUS_HISTORICO: Atualizar policies
DROP POLICY IF EXISTS "Usuários podem ver histórico de seus tickets" ON public.status_historico;
DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON public.status_historico;

CREATE POLICY "Users can view their ticket history"
ON public.status_historico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN clientes c ON c.id = t.cliente_id
    JOIN profiles p ON p.id = c.profile_id
    WHERE t.id = status_historico.ticket_id AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica') OR
  public.has_role(auth.uid(), 'tecnico_campo')
);

CREATE POLICY "System can insert history"
ON public.status_historico
FOR INSERT
WITH CHECK (true);

-- ORDENS_SERVICO: Atualizar policies
DROP POLICY IF EXISTS "Técnicos podem ver suas ordens de serviço" ON public.ordens_servico;
DROP POLICY IF EXISTS "Área técnica pode gerenciar ordens de serviço" ON public.ordens_servico;

CREATE POLICY "Technicians can view their service orders"
ON public.ordens_servico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = ordens_servico.tecnico_id AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

CREATE POLICY "Admins can manage service orders"
ON public.ordens_servico
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

-- RME_RELATORIOS: Atualizar policies
DROP POLICY IF EXISTS "Técnicos podem gerenciar seus RMEs" ON public.rme_relatorios;

CREATE POLICY "Technicians can manage their RME reports"
ON public.rme_relatorios
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

-- PRESTADORES: Atualizar policies
DROP POLICY IF EXISTS "Authenticated users can view prestadores" ON public.prestadores;
DROP POLICY IF EXISTS "Admins and technical area can manage prestadores" ON public.prestadores;

CREATE POLICY "Authenticated users can view providers"
ON public.prestadores
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage providers"
ON public.prestadores
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'area_tecnica')
);

-- ============================================
-- PARTE 3: Remover trigger antigo e atualizar função
-- ============================================

-- Remover trigger antigo (não precisamos mais dele)
DROP TRIGGER IF EXISTS trigger_criar_tecnico_automaticamente ON public.profiles;

-- Atualizar função is_admin para usar user_roles
DROP FUNCTION IF EXISTS public.is_admin(uuid);
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

-- Atualizar função get_user_role para usar user_roles
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;