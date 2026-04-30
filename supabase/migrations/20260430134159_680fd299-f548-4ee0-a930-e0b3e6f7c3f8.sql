DROP FUNCTION IF EXISTS public.get_ticket_rme_group_context(uuid);

CREATE OR REPLACE FUNCTION public.get_ticket_rme_group_context(p_ticket_id uuid)
 RETURNS TABLE(tecnico_id uuid, nome text, email text, aceite_status text, responsavel_email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WITH team AS (
    SELECT DISTINCT ON (t.id)
      t.id AS tecnico_id,
      p.nome,
      p.email,
      os.aceite_tecnico AS aceite_status
    FROM public.ordens_servico os
    JOIN public.tecnicos t ON t.id = os.tecnico_id
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE os.ticket_id = p_ticket_id
      AND os.aceite_tecnico IN ('pendente', 'aceito', 'aprovado')
    ORDER BY t.id, os.updated_at DESC, os.created_at DESC
  ),
  responsible_prestador AS (
    SELECT COALESCE(
      (SELECT tk.tecnico_responsavel_id FROM public.tickets tk WHERE tk.id = p_ticket_id),
      (
        SELECT os.tecnico_responsavel_id
        FROM public.ordens_servico os
        WHERE os.ticket_id = p_ticket_id
          AND os.tecnico_responsavel_id IS NOT NULL
        ORDER BY os.updated_at DESC, os.created_at DESC
        LIMIT 1
      )
    ) AS resp_prestador_id
  ),
  responsible_contact AS (
    SELECT COALESCE(p.email, pr.email) AS responsavel_email
    FROM responsible_prestador rp
    LEFT JOIN public.prestadores pr ON pr.id = rp.resp_prestador_id
    LEFT JOIN public.tecnicos tt ON tt.prestador_id = rp.resp_prestador_id
    LEFT JOIN public.profiles p ON p.id = tt.profile_id
    LIMIT 1
  )
  SELECT tm.tecnico_id, tm.nome, tm.email, tm.aceite_status, rc.responsavel_email
  FROM team tm
  CROSS JOIN responsible_contact rc
  ORDER BY tm.nome;
END;
$function$;