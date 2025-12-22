-- ========================================
-- MIGRAÇÃO: Adaptar tabelas OS e RME ao novo padrão
-- ========================================

-- 1. Limpar dados existentes (permitido pelo usuário)
TRUNCATE TABLE rme_relatorios CASCADE;
TRUNCATE TABLE ordens_servico CASCADE;

-- 2. Adicionar novos campos em ordens_servico
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS site_name text,
ADD COLUMN IF NOT EXISTS work_type jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS notes text;

-- 3. Adicionar novos campos em rme_relatorios
ALTER TABLE rme_relatorios 
ADD COLUMN IF NOT EXISTS weekday text,
ADD COLUMN IF NOT EXISTS collaboration jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS site_name text,
ADD COLUMN IF NOT EXISTS micro_number text,
ADD COLUMN IF NOT EXISTS inverter_number text,
ADD COLUMN IF NOT EXISTS service_type jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS shift text CHECK (shift IN ('manha', 'tarde', 'noite')),
ADD COLUMN IF NOT EXISTS start_time text,
ADD COLUMN IF NOT EXISTS end_time text,
ADD COLUMN IF NOT EXISTS images_posted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS modules_cleaned_qty integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS string_box_qty integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS signatures jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'concluido'));

-- Renomear algumas colunas para consistência (se necessário criar aliases)
-- servicos_executados -> service_performed_notes (manter original, usar como alias)

-- 4. Adicionar constraint UNIQUE para garantir 1:1 entre OS e RME
ALTER TABLE rme_relatorios 
DROP CONSTRAINT IF EXISTS rme_relatorios_ordem_servico_id_unique;

ALTER TABLE rme_relatorios 
ADD CONSTRAINT rme_relatorios_ordem_servico_id_unique UNIQUE (ordem_servico_id);

-- 5. Criar tabela de checklist items
CREATE TABLE IF NOT EXISTS public.rme_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rme_id uuid NOT NULL REFERENCES rme_relatorios(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('conexoes', 'eletrica', 'internet', 'imagens', 'ferramentas', 'epis', 'medidas_preventivas')),
  item_key text NOT NULL,
  label text NOT NULL,
  checked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rme_id, item_key)
);

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_rme_checklist_items_rme_id ON rme_checklist_items(rme_id);
CREATE INDEX IF NOT EXISTS idx_rme_checklist_items_category ON rme_checklist_items(category);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_site_name ON ordens_servico(site_name);
CREATE INDEX IF NOT EXISTS idx_rme_relatorios_status ON rme_relatorios(status);

-- 7. Habilitar RLS na nova tabela
ALTER TABLE rme_checklist_items ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS para rme_checklist_items
CREATE POLICY "Technicians and supervisors can view checklist items"
ON rme_checklist_items FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'area_tecnica'::app_role) OR
  EXISTS (
    SELECT 1 FROM rme_relatorios r
    JOIN tecnicos t ON t.id = r.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE r.id = rme_checklist_items.rme_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Technicians and supervisors can insert checklist items"
ON rme_checklist_items FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'area_tecnica'::app_role) OR
  EXISTS (
    SELECT 1 FROM rme_relatorios r
    JOIN tecnicos t ON t.id = r.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE r.id = rme_checklist_items.rme_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Technicians can update their own checklist items"
ON rme_checklist_items FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'area_tecnica'::app_role) OR
  EXISTS (
    SELECT 1 FROM rme_relatorios r
    JOIN tecnicos t ON t.id = r.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE r.id = rme_checklist_items.rme_id 
    AND p.user_id = auth.uid()
    AND r.status = 'rascunho'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'area_tecnica'::app_role) OR
  EXISTS (
    SELECT 1 FROM rme_relatorios r
    JOIN tecnicos t ON t.id = r.tecnico_id
    JOIN profiles p ON p.id = t.profile_id
    WHERE r.id = rme_checklist_items.rme_id 
    AND p.user_id = auth.uid()
    AND r.status = 'rascunho'
  )
);

CREATE POLICY "Only admins can delete checklist items"
ON rme_checklist_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. Trigger para updated_at
CREATE TRIGGER update_rme_checklist_items_updated_at
BEFORE UPDATE ON rme_checklist_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 10. Criar tabela de catálogo de checklist (para presets)
CREATE TABLE IF NOT EXISTS public.rme_checklist_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('conexoes', 'eletrica', 'internet', 'imagens', 'ferramentas', 'epis', 'medidas_preventivas')),
  item_key text NOT NULL UNIQUE,
  label text NOT NULL,
  is_default boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 11. Habilitar RLS e políticas no catálogo
ALTER TABLE rme_checklist_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view catalog"
ON rme_checklist_catalog FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can manage catalog"
ON rme_checklist_catalog FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 12. Popular catálogo com itens padrão do RME
INSERT INTO rme_checklist_catalog (category, item_key, label, sort_order) VALUES
-- Conexões
('conexoes', 'conectores_mc4', 'Conectores MC4', 1),
('conexoes', 'cabos_string', 'Cabos de String', 2),
('conexoes', 'caixa_juncao', 'Caixa de Junção', 3),
('conexoes', 'aterramento', 'Aterramento', 4),

-- Elétrica
('eletrica', 'disjuntores', 'Disjuntores', 1),
('eletrica', 'dps', 'DPS (Proteção contra Surto)', 2),
('eletrica', 'fusveis', 'Fusíveis', 3),
('eletrica', 'quadro_eletrico', 'Quadro Elétrico', 4),
('eletrica', 'medicoes', 'Medições Elétricas', 5),

-- Internet/Comunicação
('internet', 'roteador', 'Roteador', 1),
('internet', 'antena', 'Antena', 2),
('internet', 'cabos_rede', 'Cabos de Rede', 3),
('internet', 'sinal_wifi', 'Sinal WiFi', 4),
('internet', 'monitoramento', 'Sistema de Monitoramento', 5),

-- Imagens
('imagens', 'fotos_antes', 'Fotos Antes', 1),
('imagens', 'fotos_depois', 'Fotos Depois', 2),
('imagens', 'termografia', 'Termografia', 3),
('imagens', 'video_drone', 'Vídeo Drone', 4),

-- Ferramentas
('ferramentas', 'chave_torque', 'Chave Torque', 1),
('ferramentas', 'multimetro', 'Multímetro', 2),
('ferramentas', 'alicate_amperimetro', 'Alicate Amperímetro', 3),
('ferramentas', 'escada', 'Escada', 4),
('ferramentas', 'ferramentas_manuais', 'Ferramentas Manuais', 5),
('ferramentas', 'equipamento_limpeza', 'Equipamento de Limpeza', 6),

-- EPIs
('epis', 'capacete', 'Capacete', 1),
('epis', 'oculos', 'Óculos de Proteção', 2),
('epis', 'luvas', 'Luvas', 3),
('epis', 'botina', 'Botina de Segurança', 4),
('epis', 'cinto_seguranca', 'Cinto de Segurança', 5),
('epis', 'protetor_auricular', 'Protetor Auricular', 6),
('epis', 'protetor_solar', 'Protetor Solar', 7),

-- Medidas Preventivas
('medidas_preventivas', 'sinalizacao', 'Sinalização da Área', 1),
('medidas_preventivas', 'isolamento', 'Isolamento Elétrico', 2),
('medidas_preventivas', 'bloqueio_energia', 'Bloqueio de Energia', 3),
('medidas_preventivas', 'comunicacao_equipe', 'Comunicação com Equipe', 4),
('medidas_preventivas', 'verificacao_clima', 'Verificação Climática', 5)
ON CONFLICT (item_key) DO NOTHING;

-- 13. Criar função para copiar catálogo para novo RME
CREATE OR REPLACE FUNCTION public.populate_rme_checklist(p_rme_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO rme_checklist_items (rme_id, category, item_key, label, checked)
  SELECT p_rme_id, category, item_key, label, false
  FROM rme_checklist_catalog
  WHERE is_default = true
  ORDER BY category, sort_order;
END;
$$;

-- 14. Função para validar conclusão de OS (RME deve estar concluído)
CREATE OR REPLACE FUNCTION public.validate_os_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rme_status text;
  v_ticket_status text;
BEGIN
  -- Buscar status do ticket associado
  SELECT status INTO v_ticket_status
  FROM tickets
  WHERE id = NEW.ticket_id;
  
  -- Se está tentando marcar como concluído
  IF v_ticket_status = 'concluido' AND OLD.ticket_id = NEW.ticket_id THEN
    -- Verificar se existe RME concluído
    SELECT status INTO v_rme_status
    FROM rme_relatorios
    WHERE ordem_servico_id = NEW.id;
    
    IF v_rme_status IS NULL OR v_rme_status != 'concluido' THEN
      RAISE EXCEPTION 'Não é possível concluir a OS sem um RME concluído vinculado.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 15. Habilitar realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE rme_checklist_items;

-- 16. Criar bucket para evidências (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rme-evidences', 'rme-evidences', false)
ON CONFLICT (id) DO NOTHING;

-- 17. Políticas de storage para evidências
CREATE POLICY "Authenticated users can upload evidences"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rme-evidences' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view evidences"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rme-evidences' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can delete evidences"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rme-evidences' 
  AND has_role(auth.uid(), 'admin'::app_role)
);