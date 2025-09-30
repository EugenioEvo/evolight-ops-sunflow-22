-- Criar função que automaticamente cria um registro de técnico quando um perfil com role tecnico_campo é criado
CREATE OR REPLACE FUNCTION public.criar_tecnico_automaticamente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Criar trigger que executa após inserir ou atualizar um perfil
DROP TRIGGER IF EXISTS trigger_criar_tecnico ON public.profiles;
CREATE TRIGGER trigger_criar_tecnico
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_tecnico_automaticamente();

-- Criar registros de técnicos para perfis existentes com role tecnico_campo
INSERT INTO public.tecnicos (profile_id, especialidades, regiao_atuacao, registro_profissional)
SELECT 
  p.id,
  ARRAY[]::text[],
  '',
  ''
FROM public.profiles p
WHERE p.role = 'tecnico_campo'
  AND NOT EXISTS (
    SELECT 1 FROM public.tecnicos t WHERE t.profile_id = p.id
  );