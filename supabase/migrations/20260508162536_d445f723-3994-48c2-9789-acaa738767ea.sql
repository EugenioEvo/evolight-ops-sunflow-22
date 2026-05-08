CREATE TABLE public.obra_metas_catalogo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id uuid NOT NULL,
  catalogo_id uuid NOT NULL,
  quantidade_meta numeric NOT NULL DEFAULT 0,
  unidade text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, catalogo_id)
);

CREATE INDEX idx_obra_metas_obra ON public.obra_metas_catalogo(obra_id);
CREATE INDEX idx_obra_metas_catalogo ON public.obra_metas_catalogo(catalogo_id);

ALTER TABLE public.obra_metas_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage obra_metas"
  ON public.obra_metas_catalogo
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Eletromecanicos view obra_metas"
  ON public.obra_metas_catalogo
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR has_role(auth.uid(), 'eletromecanico'::app_role)
  );

CREATE POLICY "Cliente views obra_metas of own obra"
  ON public.obra_metas_catalogo
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND user_owns_obra(auth.uid(), obra_id)
  );

CREATE TRIGGER trg_obra_metas_updated
  BEFORE UPDATE ON public.obra_metas_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();