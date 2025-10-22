-- CORREÇÃO DEFINITIVA: Eliminar recursão entre clientes e tickets

-- 1) Limpar todas as policies de clientes
DROP POLICY IF EXISTS "Admin and tech area view clients" ON clientes;
DROP POLICY IF EXISTS "Admin manage clients" ON clientes;
DROP POLICY IF EXISTS "Admin and tech view clients" ON clientes;
DROP POLICY IF EXISTS "Admins can view all clients" ON clientes;
DROP POLICY IF EXISTS "Clientes podem ver seus próprios dados" ON clientes;
DROP POLICY IF EXISTS "Clients can view their own data" ON clientes;
DROP POLICY IF EXISTS "Clients view own profile" ON clientes;
DROP POLICY IF EXISTS "Clients view own data" ON clientes;
DROP POLICY IF EXISTS "System insert clients" ON clientes;
DROP POLICY IF EXISTS "Admin tem acesso total aos clientes" ON clientes;
DROP POLICY IF EXISTS "Área técnica tem acesso total aos clientes" ON clientes;
DROP POLICY IF EXISTS "Technical area can view clients with tickets" ON clientes;
DROP POLICY IF EXISTS "Technicians can view assigned clients" ON clientes;
DROP POLICY IF EXISTS "Technicians view assigned clients" ON clientes;
DROP POLICY IF EXISTS "Technicians view assigned clients (SD)" ON clientes;
DROP POLICY IF EXISTS "Technicians view all clients" ON clientes;

-- 2) Limpar todas as policies de tickets
DROP POLICY IF EXISTS "Admin and tech view tickets" ON tickets;
DROP POLICY IF EXISTS "Admin manage tickets" ON tickets;
DROP POLICY IF EXISTS "Admins and area_tecnica can manage tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;
DROP POLICY IF EXISTS "Admin and tech view tickets" ON tickets;
DROP POLICY IF EXISTS "Clients can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Clients view tickets" ON tickets;
DROP POLICY IF EXISTS "Clients view tickets they created" ON tickets;
DROP POLICY IF EXISTS "Clients create tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians can view their assigned tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians can update their assigned tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians view tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians update tickets" ON tickets;

-- 3) CLIENTES: Criar policies SIMPLES e seguras (SEM recursão)

-- Admin e área técnica veem todos os clientes
CREATE POLICY "Admin and tech area view clients" ON clientes
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Clientes veem apenas seu próprio perfil (SEM join com tickets)
CREATE POLICY "Clients view own profile" ON clientes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = clientes.profile_id
    AND p.user_id = auth.uid()
  )
);

-- Técnicos veem clientes vinculados às suas OS (usando SECURITY DEFINER - SEM recursão)
CREATE POLICY "Technicians view assigned clients (SD)" ON clientes
FOR SELECT USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  public.can_tech_view_cliente(auth.uid(), id)
);

-- Admin e área técnica gerenciam clientes
CREATE POLICY "Admin manage clients" ON clientes
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Sistema pode inserir clientes (para signup)
CREATE POLICY "System insert clients" ON clientes
FOR INSERT WITH CHECK (true);

-- 4) TICKETS: Criar policies SIMPLES (SEM recursão com clientes)

-- Admin e área técnica veem todos os tickets
CREATE POLICY "Admin and tech view tickets" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Clientes veem tickets que CRIARAM (usando created_by, SEM join com clientes)
CREATE POLICY "Clients view tickets they created" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'cliente'::app_role) AND
  created_by = auth.uid()
);

-- Técnicos veem tickets atribuídos via OS (join seguro: ordens_servico -> tecnicos -> profiles)
CREATE POLICY "Technicians view assigned tickets" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  EXISTS (
    SELECT 1
    FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id
    AND p.user_id = auth.uid()
  )
);

-- Admin e área técnica gerenciam tickets
CREATE POLICY "Admin manage tickets" ON tickets
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Clientes podem criar tickets
CREATE POLICY "Clients create tickets" ON tickets
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'cliente'::app_role) OR
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Técnicos podem atualizar tickets atribuídos (apenas em_execucao e concluido)
CREATE POLICY "Technicians update assigned tickets" ON tickets
FOR UPDATE USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  EXISTS (
    SELECT 1
    FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  status IN ('em_execucao'::ticket_status, 'concluido'::ticket_status) AND
  EXISTS (
    SELECT 1
    FROM ordens_servico os
    JOIN tecnicos t ON t.id = os.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = tickets.id
    AND p.user_id = auth.uid()
  )
);