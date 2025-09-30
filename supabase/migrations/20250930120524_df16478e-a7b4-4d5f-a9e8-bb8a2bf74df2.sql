-- Remove remaining policies that use get_user_role (which might reference user_metadata)
-- and update equipment policies

-- Update clientes policies
DROP POLICY IF EXISTS "Admins e área técnica podem ver todos os clientes v2" ON public.clientes;
DROP POLICY IF EXISTS "Admins e área técnica podem gerenciar clientes" ON public.clientes;

CREATE POLICY "Clientes select policy"
ON public.clientes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = clientes.profile_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Clientes insert policy"
ON public.clientes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Clientes update policy"
ON public.clientes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = clientes.profile_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = clientes.profile_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Clientes delete policy"
ON public.clientes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);

-- Update tecnicos policies
DROP POLICY IF EXISTS "Admins e área técnica podem ver todos os técnicos v2" ON public.tecnicos;
DROP POLICY IF EXISTS "Técnicos podem ver seu próprio perfil" ON public.tecnicos;

CREATE POLICY "Tecnicos select policy"
ON public.tecnicos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = tecnicos.profile_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Tecnicos all policy"
ON public.tecnicos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = tecnicos.profile_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = tecnicos.profile_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);

-- Update equipamentos policies to avoid get_user_role
DROP POLICY IF EXISTS "Admins and technical area can manage equipamentos" ON public.equipamentos;
DROP POLICY IF EXISTS "Clients can manage their equipamentos" ON public.equipamentos;
DROP POLICY IF EXISTS "Users can view equipamentos" ON public.equipamentos;

CREATE POLICY "Equipamentos select policy"
ON public.equipamentos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.id = equipamentos.cliente_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Equipamentos all policy"
ON public.equipamentos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.id = equipamentos.cliente_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE c.id = equipamentos.cliente_id 
    AND p.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'area_tecnica')
  )
);