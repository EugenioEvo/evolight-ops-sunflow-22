-- Adicionar sistema de aprovação aos RMEs
ALTER TABLE public.rme_relatorios 
ADD COLUMN status_aprovacao TEXT NOT NULL DEFAULT 'pendente' CHECK (status_aprovacao IN ('pendente', 'aprovado', 'rejeitado')),
ADD COLUMN aprovado_por UUID REFERENCES auth.users(id),
ADD COLUMN data_aprovacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN observacoes_aprovacao TEXT;

-- Comentários
COMMENT ON COLUMN public.rme_relatorios.status_aprovacao IS 'Status de aprovação do RME (pendente, aprovado, rejeitado)';
COMMENT ON COLUMN public.rme_relatorios.aprovado_por IS 'Usuário que aprovou/rejeitou o RME';
COMMENT ON COLUMN public.rme_relatorios.data_aprovacao IS 'Data/hora da aprovação/rejeição';
COMMENT ON COLUMN public.rme_relatorios.observacoes_aprovacao IS 'Observações da supervisão sobre a aprovação/rejeição';

-- Remover política antiga
DROP POLICY IF EXISTS "Technicians can manage their RME reports" ON public.rme_relatorios;

-- Nova política: SELECT - Admin, área técnica e técnico autor podem visualizar
CREATE POLICY "Users can view RME reports based on role"
ON public.rme_relatorios
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
  OR EXISTS (
    SELECT 1
    FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id 
    AND p.user_id = auth.uid()
  )
);

-- Nova política: INSERT - Técnicos, admin e área técnica podem criar
CREATE POLICY "Technicians and supervisors can create RME reports"
ON public.rme_relatorios
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
  OR EXISTS (
    SELECT 1
    FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id 
    AND p.user_id = auth.uid()
  )
);

-- Nova política: UPDATE - Técnico autor pode editar apenas se pendente
CREATE POLICY "Technicians can update their own pending RME reports"
ON public.rme_relatorios
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id 
    AND p.user_id = auth.uid()
    AND rme_relatorios.status_aprovacao = 'pendente'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = rme_relatorios.tecnico_id 
    AND p.user_id = auth.uid()
    AND rme_relatorios.status_aprovacao = 'pendente'
  )
);

-- Nova política: UPDATE - Admin e área técnica podem aprovar/rejeitar
CREATE POLICY "Supervisors can approve or reject RME reports"
ON public.rme_relatorios
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Nova política: DELETE - Apenas admin pode deletar
CREATE POLICY "Only admins can delete RME reports"
ON public.rme_relatorios
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));