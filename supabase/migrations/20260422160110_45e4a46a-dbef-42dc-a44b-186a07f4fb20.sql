
-- Add candidate workflow columns to prestadores
ALTER TABLE public.prestadores 
  ADD COLUMN IF NOT EXISTS status_candidatura text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS data_avaliacao timestamptz,
  ADD COLUMN IF NOT EXISTS avaliado_por uuid,
  ADD COLUMN IF NOT EXISTS observacoes_candidato text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Constraint on status values
ALTER TABLE public.prestadores
  DROP CONSTRAINT IF EXISTS prestadores_status_candidatura_check;
ALTER TABLE public.prestadores
  ADD CONSTRAINT prestadores_status_candidatura_check
  CHECK (status_candidatura IN ('pendente', 'aprovado', 'rejeitado'));

-- Mark existing inactive ones as pending (the self-signup flow created them this way)
UPDATE public.prestadores 
SET status_candidatura = 'pendente' 
WHERE ativo = false AND status_candidatura = 'aprovado';

-- Allow ANONYMOUS candidacy submissions
DROP POLICY IF EXISTS "Anyone can submit candidacy" ON public.prestadores;
CREATE POLICY "Anyone can submit candidacy"
ON public.prestadores
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status_candidatura = 'pendente' 
  AND ativo = false
  AND avaliado_por IS NULL
  AND data_avaliacao IS NULL
);
