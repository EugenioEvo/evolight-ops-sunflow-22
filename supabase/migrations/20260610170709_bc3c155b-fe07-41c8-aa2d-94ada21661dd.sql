CREATE OR REPLACE FUNCTION public.list_rdo_eletromecanicos(p_only_supervisores boolean DEFAULT false)
RETURNS TABLE(id uuid, nome text, categoria text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cats text[];
BEGIN
  IF p_only_supervisores THEN
    v_cats := ARRAY['sup_eletromecanico','lider_eletromecanico'];
  ELSE
    v_cats := ARRAY['eletromecanico','sup_eletromecanico','lider_eletromecanico'];
  END IF;

  RETURN QUERY
  WITH by_cat AS (
    SELECT p.id, p.nome, p.categoria::text AS categoria
    FROM public.prestadores p
    WHERE p.ativo = true AND p.categoria::text = ANY(v_cats)
  ),
  by_role AS (
    SELECT p.id, p.nome, p.categoria::text AS categoria
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.user_id = ur.user_id
    JOIN public.tecnicos t ON t.profile_id = pr.id AND t.prestador_id IS NOT NULL
    JOIN public.prestadores p ON p.id = t.prestador_id
    WHERE ur.role::text = ANY(v_cats) AND p.ativo = true
  )
  SELECT u.id, u.nome, u.categoria
  FROM (SELECT * FROM by_cat UNION SELECT * FROM by_role) u
  ORDER BY u.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_rdo_eletromecanicos(boolean) TO authenticated;