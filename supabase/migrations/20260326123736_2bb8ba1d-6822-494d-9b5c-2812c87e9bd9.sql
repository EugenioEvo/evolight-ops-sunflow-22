CREATE POLICY "Technicians can update aceite on their own OS"
ON public.ordens_servico
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = ordens_servico.tecnico_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tecnicos t
    JOIN profiles p ON p.id = t.profile_id
    WHERE t.id = ordens_servico.tecnico_id
    AND p.user_id = auth.uid()
  )
);