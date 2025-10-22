-- SOLUÇÃO DEFINITIVA: Remover todas as policies que causam recursão entre clientes e tickets

-- Limpar policies de clientes
DROP POLICY IF EXISTS "Admins and technical area view all clients" ON clientes;
DROP POLICY IF EXISTS "Clients view own data" ON clientes;
DROP POLICY IF EXISTS "Technicians view assigned clients (SD)" ON clientes;
DROP POLICY IF EXISTS "Admins manage clients" ON clientes;
DROP POLICY IF EXISTS "System insert clients" ON clientes;

-- Limpar policies de tickets
DROP POLICY IF EXISTS "Admins view all tickets" ON tickets;
DROP POLICY IF EXISTS "Clients view own tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians view assigned tickets" ON tickets;
DROP POLICY IF EXISTS "Admins manage tickets" ON tickets;
DROP POLICY IF EXISTS "Clients create tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians update assigned tickets" ON tickets;

-- Criar policies SIMPLES para clientes (SEM referência a tickets)
CREATE POLICY "Admin and tech area view clients" ON clientes
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Clients view own profile" ON clientes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = clientes.profile_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Technicians view all clients" ON clientes
FOR SELECT USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role)
);

CREATE POLICY "Admin manage clients" ON clientes
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "System insert clients" ON clientes
FOR INSERT WITH CHECK (true);

-- Criar policies SIMPLES para tickets (SEM referência complexa a clientes)
CREATE POLICY "Admin and tech view tickets" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Clients view tickets" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'cliente'::app_role)
);

CREATE POLICY "Technicians view tickets" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role)
);

CREATE POLICY "Admin manage tickets" ON tickets
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Clients create tickets" ON tickets
FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'cliente'::app_role) OR
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Technicians update tickets" ON tickets
FOR UPDATE USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  status IN ('em_execucao'::ticket_status, 'concluido'::ticket_status)
)
WITH CHECK (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  status IN ('em_execucao'::ticket_status, 'concluido'::ticket_status)
);