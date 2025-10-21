-- Remover trigger e função antigos em cascata
DROP TRIGGER IF EXISTS validate_os_tecnico_assignment ON ordens_servico;
DROP FUNCTION IF EXISTS validate_os_tecnico() CASCADE;

-- Criar nova função que valida corretamente na tabela tecnicos
CREATE OR REPLACE FUNCTION public.validate_os_tecnico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se tecnico_id não for nulo, validar se existe na tabela tecnicos
  IF NEW.tecnico_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tecnicos 
      WHERE id = NEW.tecnico_id
    ) THEN
      RAISE EXCEPTION 'O ID do técnico não é válido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para validação
CREATE TRIGGER validate_os_tecnico_assignment
BEFORE INSERT OR UPDATE ON ordens_servico
FOR EACH ROW
EXECUTE FUNCTION validate_os_tecnico();