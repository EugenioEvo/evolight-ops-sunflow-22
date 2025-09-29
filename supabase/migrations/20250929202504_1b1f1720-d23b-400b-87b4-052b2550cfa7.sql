-- Criar buckets de storage
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-anexos', 'ticket-anexos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('rme-fotos', 'rme-fotos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('ordens-servico', 'ordens-servico', false);

-- Políticas de storage para anexos de tickets
CREATE POLICY "Usuários podem ver anexos de seus tickets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ticket-anexos' AND
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.clientes c ON c.id = t.cliente_id
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.user_id = auth.uid()
    AND t.anexos @> ARRAY[storage.objects.name]
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica', 'tecnico_campo')
  )
);

CREATE POLICY "Usuários podem fazer upload de anexos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-anexos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Políticas de storage para fotos RME
CREATE POLICY "Técnicos podem gerenciar fotos RME"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'rme-fotos' AND
  (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
    )
  )
);

-- Políticas de storage para PDFs de ordens de serviço
CREATE POLICY "Usuários podem ver PDFs de suas OS"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ordens-servico' AND
  (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      JOIN public.tickets t ON t.id = os.ticket_id
      JOIN public.clientes c ON c.id = t.cliente_id
      JOIN public.profiles p ON p.id = c.profile_id
      WHERE p.user_id = auth.uid()
      AND os.pdf_url LIKE '%' || storage.objects.name || '%'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica', 'tecnico_campo')
    )
  )
);

CREATE POLICY "Sistema pode criar PDFs de OS"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'ordens-servico');