
ALTER TABLE public.rdo_relatorios DROP CONSTRAINT IF EXISTS rdo_relatorios_clima_check;
ALTER TABLE public.rdo_relatorios ADD CONSTRAINT rdo_relatorios_clima_check
  CHECK (clima IS NULL OR clima = ANY (ARRAY[
    'ensolarado'::text, 'nublado'::text, 'chuvoso'::text, 'chuva_forte'::text, 'misto'::text
  ]));
