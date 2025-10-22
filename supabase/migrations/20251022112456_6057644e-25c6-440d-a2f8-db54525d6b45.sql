-- Remover todas as policies que estão causando recursão
DROP POLICY IF EXISTS "Users can view clients based on role" ON clientes;
DROP POLICY IF EXISTS "Admins can manage clients" ON clientes;
DROP POLICY IF EXISTS "System can insert clients" ON clientes;
DROP POLICY IF EXISTS "Users can view tickets based on role" ON tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON tickets;
DROP POLICY IF EXISTS "Clients can create tickets" ON tickets;
DROP POLICY IF EXISTS "Technicians can update assigned tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view approvals" ON aprovacoes;
DROP POLICY IF EXISTS "Admins can manage approvals" ON aprovacoes;
DROP POLICY IF EXISTS "Users can view history" ON status_historico;
DROP POLICY IF EXISTS "System can insert history" ON status_historico;
DROP POLICY IF EXISTS "Users can view equipment" ON equipamentos;
DROP POLICY IF EXISTS "Admins can manage equipment" ON equipamentos;

-- Remover funções antigas
DROP FUNCTION IF EXISTS public.can_user_view_cliente(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_user_manage_cliente(uuid);
DROP FUNCTION IF EXISTS public.can_user_view_ticket(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_tech_update_ticket(uuid, uuid);

-- Recriar policies SIMPLES e DIRETAS para clientes
CREATE POLICY "Admins and technical area view all clients" ON clientes
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Clients view own data" ON clientes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = clientes.profile_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Technicians view assigned clients" ON clientes
FOR SELECT USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  EXISTS (
    SELECT 1 FROM tecnicos tec
    JOIN profiles p ON p.id = tec.profile_id
    WHERE p.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets t
      JOIN ordens_servico os ON os.ticket_id = t.id
      WHERE t.cliente_id = clientes.id
      AND os.tecnico_id = tec.id
    )
  )
);

CREATE POLICY "Admins manage clients" ON clientes
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "System insert clients" ON clientes
FOR INSERT WITH CHECK (true);

-- Policies para tickets
CREATE POLICY "Admins view all tickets" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Clients view own tickets" ON tickets
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN profiles p ON p.id = c.profile_id
    WHERE c.id = tickets.cliente_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Technicians view assigned tickets" ON tickets
FOR SELECT USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  EXISTS (
    SELECT 1 FROM ordens_servico os
    JOIN tecnicos tec ON tec.id = os.tecnico_id
    JOIN profiles p ON p.id = tec.profile_id
    WHERE os.ticket_id = tickets.id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage tickets" ON tickets
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Clients create tickets" ON tickets
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN profiles p ON p.id = c.profile_id
    WHERE c.id = tickets.cliente_id
    AND p.user_id = auth.uid()
  ) OR
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Technicians update assigned tickets" ON tickets
FOR UPDATE USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  EXISTS (
    SELECT 1 FROM ordens_servico os
    JOIN tecnicos tec ON tec.id = os.tecnico_id
    JOIN profiles p ON p.id = tec.profile_id
    WHERE os.ticket_id = tickets.id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  status IN ('em_execucao'::ticket_status, 'concluido'::ticket_status) AND
  EXISTS (
    SELECT 1 FROM ordens_servico os
    JOIN tecnicos tec ON tec.id = os.tecnico_id
    JOIN profiles p ON p.id = tec.profile_id
    WHERE os.ticket_id = tickets.id
    AND p.user_id = auth.uid()
  )
);

-- Policies para aprovacoes
CREATE POLICY "All authenticated view approvals" ON aprovacoes
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role) OR
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) OR
  public.has_role(auth.uid(), 'cliente'::app_role)
);

CREATE POLICY "Admins manage approvals" ON aprovacoes
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Policies para status_historico
CREATE POLICY "All authenticated view history" ON status_historico
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role) OR
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) OR
  public.has_role(auth.uid(), 'cliente'::app_role)
);

CREATE POLICY "System insert history" ON status_historico
FOR INSERT WITH CHECK (true);

-- Policies para equipamentos
CREATE POLICY "Admins view all equipment" ON equipamentos
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Clients view own equipment" ON equipamentos
FOR SELECT USING (
  cliente_id IS NULL OR
  EXISTS (
    SELECT 1 FROM clientes c
    JOIN profiles p ON p.id = c.profile_id
    WHERE c.id = equipamentos.cliente_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage equipment" ON equipamentos
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'area_tecnica'::app_role)
);