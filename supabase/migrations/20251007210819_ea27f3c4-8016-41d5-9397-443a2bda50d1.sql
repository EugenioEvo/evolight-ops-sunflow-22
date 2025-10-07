-- Adicionar constraint única em tecnicos(profile_id) para suportar ON CONFLICT
ALTER TABLE public.tecnicos 
ADD CONSTRAINT tecnicos_profile_id_unique UNIQUE (profile_id);

-- Corrigir a função criar_tecnico_automaticamente
CREATE OR REPLACE FUNCTION public.criar_tecnico_automaticamente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o role for tecnico_campo, criar registro na tabela tecnicos
  IF NEW.role = 'tecnico_campo' THEN
    INSERT INTO public.tecnicos (
      profile_id,
      especialidades,
      regiao_atuacao,
      registro_profissional
    ) VALUES (
      NEW.id,
      ARRAY[]::text[],
      '',
      ''
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função automaticamente
DROP TRIGGER IF EXISTS trigger_criar_tecnico_automaticamente ON public.profiles;
CREATE TRIGGER trigger_criar_tecnico_automaticamente
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_tecnico_automaticamente();