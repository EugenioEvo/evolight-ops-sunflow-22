CREATE POLICY "Technicians can view own provider record by email"
ON public.prestadores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tecnico_campo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.tecnicos t ON t.profile_id = p.id
    WHERE p.user_id = auth.uid()
      AND lower(p.email) = lower(prestadores.email)
  )
);