-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage responsaveis" ON public.responsaveis;
DROP POLICY IF EXISTS "Authenticated users can view responsaveis" ON public.responsaveis;

-- Only admins and area_tecnica can view contacts
CREATE POLICY "Admins and technical area can view contacts"
ON public.responsaveis
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Only admins and area_tecnica can insert contacts
CREATE POLICY "Admins and technical area can insert contacts"
ON public.responsaveis
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Only admins and area_tecnica can update contacts
CREATE POLICY "Admins and technical area can update contacts"
ON public.responsaveis
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);

-- Only admins and area_tecnica can delete contacts
CREATE POLICY "Admins and technical area can delete contacts"
ON public.responsaveis
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'area_tecnica'::app_role)
);