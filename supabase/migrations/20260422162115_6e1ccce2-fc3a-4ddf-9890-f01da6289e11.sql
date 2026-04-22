-- 1. Add FK column linking tecnicos -> prestadores
ALTER TABLE public.tecnicos
ADD COLUMN IF NOT EXISTS prestador_id uuid REFERENCES public.prestadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tecnicos_prestador_id ON public.tecnicos(prestador_id);

-- 2. Backfill: link existing tecnicos to their prestador via email match (case-insensitive)
UPDATE public.tecnicos t
SET prestador_id = p.id
FROM public.profiles pr, public.prestadores p
WHERE t.profile_id = pr.id
  AND lower(p.email) = lower(pr.email)
  AND t.prestador_id IS NULL;

-- 3. Replace the fragile email-based RLS policy on prestadores with one that uses the FK
DROP POLICY IF EXISTS "Technicians can view own provider record by email" ON public.prestadores;

CREATE POLICY "Technicians view own provider record via FK"
ON public.prestadores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tecnico_campo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.tecnicos t
    JOIN public.profiles pr ON pr.id = t.profile_id
    WHERE t.prestador_id = prestadores.id
      AND pr.user_id = auth.uid()
  )
);