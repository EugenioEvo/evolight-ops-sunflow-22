-- Remover o trigger problemático que tenta acessar campo 'role' que não existe em profiles
DROP TRIGGER IF EXISTS trigger_criar_tecnico_automaticamente ON public.profiles;
DROP TRIGGER IF EXISTS trigger_criar_tecnico ON public.profiles;

-- Remover a função que causa o erro
DROP FUNCTION IF EXISTS public.criar_tecnico_automaticamente();

-- A criação de técnicos já é feita corretamente pelo edge function create-user-profile
-- que cria o registro em tecnicos quando user_roles.role = 'tecnico_campo'