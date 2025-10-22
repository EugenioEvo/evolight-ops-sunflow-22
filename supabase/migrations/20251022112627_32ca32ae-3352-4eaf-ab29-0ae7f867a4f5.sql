-- Função SECURITY DEFINER para técnicos verem clientes vinculados a suas OS, sem acionar RLS
CREATE OR REPLACE FUNCTION public.can_tech_view_cliente(p_user_id uuid, p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM ordens_servico os
    JOIN tickets t ON t.id = os.ticket_id
    JOIN tecnicos tec ON tec.id = os.tecnico_id
    JOIN profiles p ON p.id = tec.profile_id
    WHERE t.cliente_id = p_cliente_id
      AND p.user_id = p_user_id
  );
$$;

-- Substituir policy de técnicos em clientes para usar a função SD (evita recursão)
DROP POLICY IF EXISTS "Technicians view assigned clients" ON clientes;

CREATE POLICY "Technicians view assigned clients (SD)" ON clientes
FOR SELECT USING (
  public.has_role(auth.uid(), 'tecnico_campo'::app_role) AND
  public.can_tech_view_cliente(auth.uid(), id)
);
