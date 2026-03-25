-- Create helper function is_staff (admin OR engenharia OR supervisao)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
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
      AND role IN ('admin'::app_role, 'engenharia'::app_role, 'supervisao'::app_role)
  )
$$;

-- === TECNICOS ===
DROP POLICY IF EXISTS "Admins can manage technicians" ON tecnicos;
CREATE POLICY "Admins can manage technicians" ON tecnicos FOR ALL TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Technicians can view their own data" ON tecnicos;
CREATE POLICY "Technicians can view their own data" ON tecnicos FOR SELECT TO public USING ((EXISTS (SELECT 1 FROM profiles p WHERE p.id = tecnicos.profile_id AND p.user_id = auth.uid())) OR is_staff(auth.uid()));

-- === RME_CHECKLIST_ITEMS ===
DROP POLICY IF EXISTS "Technicians and supervisors can insert checklist items" ON rme_checklist_items;
CREATE POLICY "Technicians and supervisors can insert checklist items" ON rme_checklist_items FOR INSERT TO public WITH CHECK (is_staff(auth.uid()) OR (EXISTS (SELECT 1 FROM rme_relatorios r JOIN tecnicos t ON t.id = r.tecnico_id JOIN profiles p ON p.id = t.profile_id WHERE r.id = rme_checklist_items.rme_id AND p.user_id = auth.uid())));
DROP POLICY IF EXISTS "Technicians and supervisors can view checklist items" ON rme_checklist_items;
CREATE POLICY "Technicians and supervisors can view checklist items" ON rme_checklist_items FOR SELECT TO public USING (is_staff(auth.uid()) OR (EXISTS (SELECT 1 FROM rme_relatorios r JOIN tecnicos t ON t.id = r.tecnico_id JOIN profiles p ON p.id = t.profile_id WHERE r.id = rme_checklist_items.rme_id AND p.user_id = auth.uid())));
DROP POLICY IF EXISTS "Technicians can update their own checklist items" ON rme_checklist_items;
CREATE POLICY "Technicians can update their own checklist items" ON rme_checklist_items FOR UPDATE TO public USING (is_staff(auth.uid()) OR (EXISTS (SELECT 1 FROM rme_relatorios r JOIN tecnicos t ON t.id = r.tecnico_id JOIN profiles p ON p.id = t.profile_id WHERE r.id = rme_checklist_items.rme_id AND p.user_id = auth.uid() AND r.status = 'rascunho'))) WITH CHECK (is_staff(auth.uid()) OR (EXISTS (SELECT 1 FROM rme_relatorios r JOIN tecnicos t ON t.id = r.tecnico_id JOIN profiles p ON p.id = t.profile_id WHERE r.id = rme_checklist_items.rme_id AND p.user_id = auth.uid() AND r.status = 'rascunho')));

-- === RME_RELATORIOS ===
DROP POLICY IF EXISTS "Supervisors can approve or reject RME reports" ON rme_relatorios;
CREATE POLICY "Supervisors can approve or reject RME reports" ON rme_relatorios FOR UPDATE TO public USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Technicians and supervisors can create RME reports" ON rme_relatorios;
CREATE POLICY "Technicians and supervisors can create RME reports" ON rme_relatorios FOR INSERT TO public WITH CHECK (is_staff(auth.uid()) OR (EXISTS (SELECT 1 FROM tecnicos t JOIN profiles p ON p.id = t.profile_id WHERE t.id = rme_relatorios.tecnico_id AND p.user_id = auth.uid())));
DROP POLICY IF EXISTS "Users can view RME reports based on role" ON rme_relatorios;
CREATE POLICY "Users can view RME reports based on role" ON rme_relatorios FOR SELECT TO public USING (is_staff(auth.uid()) OR (EXISTS (SELECT 1 FROM tecnicos t JOIN profiles p ON p.id = t.profile_id WHERE t.id = rme_relatorios.tecnico_id AND p.user_id = auth.uid())));

-- === PRESTADORES ===
DROP POLICY IF EXISTS "Admins can manage providers" ON prestadores;
CREATE POLICY "Admins can manage providers" ON prestadores FOR ALL TO public USING (is_staff(auth.uid()));

-- === ROUTE_OPTIMIZATIONS ===
DROP POLICY IF EXISTS "Admins can manage route optimizations" ON route_optimizations;
CREATE POLICY "Admins can manage route optimizations" ON route_optimizations FOR ALL TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins can view all route optimizations" ON route_optimizations;
CREATE POLICY "Admins can view all route optimizations" ON route_optimizations FOR SELECT TO public USING (is_staff(auth.uid()));

-- === GEOCODING_CACHE ===
DROP POLICY IF EXISTS "Admins and area_tecnica can delete geocoding cache" ON geocoding_cache;
CREATE POLICY "Staff can delete geocoding cache" ON geocoding_cache FOR DELETE TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and area_tecnica can insert geocoding cache" ON geocoding_cache;
CREATE POLICY "Staff can insert geocoding cache" ON geocoding_cache FOR INSERT TO public WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and area_tecnica can update geocoding cache" ON geocoding_cache;
CREATE POLICY "Staff can update geocoding cache" ON geocoding_cache FOR UPDATE TO public USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and area_tecnica can view geocoding cache" ON geocoding_cache;
CREATE POLICY "Staff can view geocoding cache" ON geocoding_cache FOR SELECT TO public USING (is_staff(auth.uid()));

-- === ORDENS_SERVICO ===
DROP POLICY IF EXISTS "Admins can manage service orders" ON ordens_servico;
CREATE POLICY "Admins can manage service orders" ON ordens_servico FOR ALL TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Technicians can view their service orders" ON ordens_servico;
CREATE POLICY "Technicians can view their service orders" ON ordens_servico FOR SELECT TO public USING ((EXISTS (SELECT 1 FROM tecnicos t JOIN profiles p ON p.id = t.profile_id WHERE t.id = ordens_servico.tecnico_id AND p.user_id = auth.uid())) OR is_staff(auth.uid()));

-- === STATUS_HISTORICO ===
DROP POLICY IF EXISTS "All authenticated view history" ON status_historico;
CREATE POLICY "All authenticated view history" ON status_historico FOR SELECT TO public USING (is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role) OR has_role(auth.uid(), 'cliente'::app_role));
DROP POLICY IF EXISTS "Users can view their ticket history" ON status_historico;
CREATE POLICY "Users can view their ticket history" ON status_historico FOR SELECT TO public USING ((EXISTS (SELECT 1 FROM tickets t JOIN clientes c ON c.id = t.cliente_id JOIN profiles p ON p.id = c.profile_id WHERE t.id = status_historico.ticket_id AND p.user_id = auth.uid())) OR is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role));

-- === TICKETS ===
DROP POLICY IF EXISTS "Admin and tech view tickets" ON tickets;
CREATE POLICY "Admin and tech view tickets" ON tickets FOR SELECT TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admin manage tickets" ON tickets;
CREATE POLICY "Admin manage tickets" ON tickets FOR ALL TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Clients create tickets" ON tickets;
CREATE POLICY "Clients create tickets" ON tickets FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'cliente'::app_role) OR is_staff(auth.uid()));

-- === INSUMOS ===
DROP POLICY IF EXISTS "Admins and technical area can delete inventory" ON insumos;
CREATE POLICY "Staff can delete inventory" ON insumos FOR DELETE TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and technical area can insert inventory" ON insumos;
CREATE POLICY "Staff can insert inventory" ON insumos FOR INSERT TO public WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and technical area can update inventory" ON insumos;
CREATE POLICY "Staff can update inventory" ON insumos FOR UPDATE TO public USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and technical area can view inventory" ON insumos;
CREATE POLICY "Staff can view inventory" ON insumos FOR SELECT TO public USING (is_staff(auth.uid()));

-- === RESPONSAVEIS ===
DROP POLICY IF EXISTS "Admins and technical area can delete contacts" ON responsaveis;
CREATE POLICY "Staff can delete contacts" ON responsaveis FOR DELETE TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and technical area can insert contacts" ON responsaveis;
CREATE POLICY "Staff can insert contacts" ON responsaveis FOR INSERT TO public WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and technical area can update contacts" ON responsaveis;
CREATE POLICY "Staff can update contacts" ON responsaveis FOR UPDATE TO public USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins and technical area can view contacts" ON responsaveis;
CREATE POLICY "Staff can view contacts" ON responsaveis FOR SELECT TO public USING (is_staff(auth.uid()));

-- === PROFILES ===
DROP POLICY IF EXISTS "Users can view their own profile or if admin/area_tecnica" ON profiles;
CREATE POLICY "Users can view their own profile or if staff" ON profiles FOR SELECT TO public USING (auth.uid() = user_id OR is_staff(auth.uid()));

-- === MOVIMENTACOES ===
DROP POLICY IF EXISTS "Admins and tech can manage movimentacoes" ON movimentacoes;
CREATE POLICY "Staff can manage movimentacoes" ON movimentacoes FOR ALL TO public USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Technicians can view movimentacoes" ON movimentacoes;
CREATE POLICY "Technicians can view movimentacoes" ON movimentacoes FOR SELECT TO public USING (is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role));

-- === APROVACOES ===
DROP POLICY IF EXISTS "Admins manage approvals" ON aprovacoes;
CREATE POLICY "Admins manage approvals" ON aprovacoes FOR ALL TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "All authenticated view approvals" ON aprovacoes;
CREATE POLICY "All authenticated view approvals" ON aprovacoes FOR SELECT TO public USING (is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role) OR has_role(auth.uid(), 'cliente'::app_role));
DROP POLICY IF EXISTS "Users can view approvals for their tickets" ON aprovacoes;
CREATE POLICY "Users can view approvals for their tickets" ON aprovacoes FOR SELECT TO public USING ((EXISTS (SELECT 1 FROM tickets t JOIN clientes c ON c.id = t.cliente_id JOIN profiles p ON p.id = c.profile_id WHERE t.id = aprovacoes.ticket_id AND p.user_id = auth.uid())) OR is_staff(auth.uid()) OR has_role(auth.uid(), 'tecnico_campo'::app_role));

-- === NOTIFICACOES ===
DROP POLICY IF EXISTS "Admins can create notifications" ON notificacoes;
CREATE POLICY "Admins can create notifications" ON notificacoes FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));

-- === EQUIPAMENTOS ===
DROP POLICY IF EXISTS "Admins manage equipment" ON equipamentos;
CREATE POLICY "Admins manage equipment" ON equipamentos FOR ALL TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins view all equipment" ON equipamentos;
CREATE POLICY "Admins view all equipment" ON equipamentos FOR SELECT TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Clients can view their own equipment" ON equipamentos;
CREATE POLICY "Clients can view their own equipment" ON equipamentos FOR SELECT TO public USING ((EXISTS (SELECT 1 FROM clientes c JOIN profiles p ON p.id = c.profile_id WHERE c.id = equipamentos.cliente_id AND p.user_id = auth.uid())) OR is_staff(auth.uid()));

-- === CLIENTES ===
DROP POLICY IF EXISTS "Admin and tech area view clients" ON clientes;
CREATE POLICY "Staff view clients" ON clientes FOR SELECT TO public USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admin manage clients" ON clientes;
CREATE POLICY "Staff manage clients" ON clientes FOR ALL TO public USING (is_staff(auth.uid()));