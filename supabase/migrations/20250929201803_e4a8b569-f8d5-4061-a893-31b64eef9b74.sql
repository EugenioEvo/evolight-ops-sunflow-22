-- Políticas RLS para tecnicos
CREATE POLICY "Técnicos podem ver seu próprio perfil"
ON public.tecnicos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = tecnicos.profile_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins e área técnica podem ver todos os técnicos"
ON public.tecnicos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

-- Políticas RLS para clientes
CREATE POLICY "Clientes podem ver seu próprio perfil"
ON public.clientes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = clientes.profile_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins e área técnica podem ver todos os clientes"
ON public.clientes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

-- Políticas RLS para aprovacoes
CREATE POLICY "Área técnica pode gerenciar aprovações"
ON public.aprovacoes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Usuários podem ver aprovações de seus tickets"
ON public.aprovacoes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.clientes c ON c.id = t.cliente_id
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE t.id = aprovacoes.ticket_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica', 'tecnico_campo')
  )
);

-- Políticas RLS para ordens_servico
CREATE POLICY "Técnicos podem ver suas ordens de serviço"
ON public.ordens_servico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tecnicos t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.id = ordens_servico.tecnico_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Área técnica pode gerenciar ordens de serviço"
ON public.ordens_servico
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

-- Políticas RLS para rme_relatorios
CREATE POLICY "Técnicos podem gerenciar seus RMEs"
ON public.rme_relatorios
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tecnicos t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

-- Políticas RLS para status_historico
CREATE POLICY "Usuários podem ver histórico de seus tickets"
ON public.status_historico
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.clientes c ON c.id = t.cliente_id
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE t.id = status_historico.ticket_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica', 'tecnico_campo')
  )
);

CREATE POLICY "Sistema pode inserir histórico"
ON public.status_historico
FOR INSERT
WITH CHECK (true);