
CREATE POLICY "Eletromec staff view all rdo atividades"
ON public.rdo_atividades FOR SELECT
USING (has_role(auth.uid(), 'sup_eletromecanico'::app_role) OR has_role(auth.uid(), 'lider_eletromecanico'::app_role));

CREATE POLICY "Eletromec staff view all rdo equipe"
ON public.rdo_equipe FOR SELECT
USING (has_role(auth.uid(), 'sup_eletromecanico'::app_role) OR has_role(auth.uid(), 'lider_eletromecanico'::app_role));

CREATE POLICY "Eletromec staff view all rdo equipamentos"
ON public.rdo_equipamentos FOR SELECT
USING (has_role(auth.uid(), 'sup_eletromecanico'::app_role) OR has_role(auth.uid(), 'lider_eletromecanico'::app_role));

CREATE POLICY "Eletromec staff view all rdo evidencias"
ON public.rdo_evidencias FOR SELECT
USING (has_role(auth.uid(), 'sup_eletromecanico'::app_role) OR has_role(auth.uid(), 'lider_eletromecanico'::app_role));
