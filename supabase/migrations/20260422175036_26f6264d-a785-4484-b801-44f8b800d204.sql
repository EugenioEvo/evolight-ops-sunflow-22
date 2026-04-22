CREATE OR REPLACE FUNCTION public.get_ticket_rme_group_context(p_ticket_id uuid)
RETURNS TABLE (
  tecnico_id uuid,
  nome text,
  email text,
  responsavel_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_access boolean;
BEGIN
  SELECT (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.ordens_servico os
      JOIN public.tecnicos t ON t.id = os.tecnico_id
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE os.ticket_id = p_ticket_id
        AND p.user_id = auth.uid()
    )
  ) INTO v_can_access;

  IF NOT COALESCE(v_can_access, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH accepted_team AS (
    SELECT DISTINCT ON (t.id)
      t.id AS tecnico_id,
      p.nome,
      p.email
    FROM public.ordens_servico os
    JOIN public.tecnicos t ON t.id = os.tecnico_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = p_ticket_id
      AND os.aceite_tecnico IN ('aceito', 'aprovado')
    ORDER BY t.id, os.updated_at DESC, os.created_at DESC
  ), responsible_contact AS (
    SELECT pr.email AS responsavel_email
    FROM public.tickets tk
    LEFT JOIN public.prestadores pr ON pr.id = tk.tecnico_responsavel_id
    WHERE tk.id = p_ticket_id
    LIMIT 1
  )
  SELECT at.tecnico_id, at.nome, at.email, rc.responsavel_email
  FROM accepted_team at
  CROSS JOIN responsible_contact rc
  ORDER BY at.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ticket_rme_group_context(uuid) TO authenticated;