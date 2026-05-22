
-- 1) Acrescenta vínculo opcional a Obra e anexos de evidência em saídas de insumo
ALTER TABLE public.insumo_saidas
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidencias jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS insumo_saidas_obra_id_idx ON public.insumo_saidas(obra_id);

-- Validação: cada saída tem exatamente UM destino (OS, Obra ou Uso Interno)
CREATE OR REPLACE FUNCTION public.validate_insumo_saida_destino()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c int := 0;
BEGIN
  IF NEW.ordem_servico_id IS NOT NULL THEN c := c + 1; END IF;
  IF NEW.obra_id IS NOT NULL THEN c := c + 1; END IF;
  IF COALESCE(NEW.uso_interno, false) THEN c := c + 1; END IF;
  IF c <> 1 THEN
    RAISE EXCEPTION 'Saída de insumo deve ter exatamente um destino: OS, Obra ou Uso Interno (recebeu %).', c;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_insumo_saida_destino ON public.insumo_saidas;
CREATE TRIGGER trg_validate_insumo_saida_destino
BEFORE INSERT OR UPDATE ON public.insumo_saidas
FOR EACH ROW EXECUTE FUNCTION public.validate_insumo_saida_destino();

-- 2) Bucket para evidências de saída (privado, igual ao de devolução)
INSERT INTO storage.buckets (id, name, public)
VALUES ('saida-evidencias', 'saida-evidencias', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Saida evidencias: select staff/backoffice/owner" ON storage.objects;
CREATE POLICY "Saida evidencias: select staff/backoffice/owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'saida-evidencias' AND (
    public.is_staff_or_backoffice(auth.uid())
    OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

DROP POLICY IF EXISTS "Saida evidencias: insert staff/backoffice/tecnico" ON storage.objects;
CREATE POLICY "Saida evidencias: insert staff/backoffice/tecnico"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'saida-evidencias' AND (
    public.is_staff_or_backoffice(auth.uid())
    OR has_role(auth.uid(), 'tecnico_campo'::app_role)
  )
);

DROP POLICY IF EXISTS "Saida evidencias: delete staff/backoffice" ON storage.objects;
CREATE POLICY "Saida evidencias: delete staff/backoffice"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'saida-evidencias' AND public.is_staff_or_backoffice(auth.uid())
);
