-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage insumos" ON public.insumos;
DROP POLICY IF EXISTS "Authenticated users can view insumos" ON public.insumos;

-- Only admins and area_tecnica can view inventory
CREATE POLICY "Admins and technical area can view inventory"
ON public.insumos
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Only admins and area_tecnica can insert inventory items
CREATE POLICY "Admins and technical area can insert inventory"
ON public.insumos
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Only admins and area_tecnica can update inventory items
CREATE POLICY "Admins and technical area can update inventory"
ON public.insumos
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Only admins and area_tecnica can delete inventory items
CREATE POLICY "Admins and technical area can delete inventory"
ON public.insumos
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);