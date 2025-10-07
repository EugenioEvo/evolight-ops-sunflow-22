-- Criar trigger para criar técnico automaticamente quando perfil é criado
CREATE TRIGGER trigger_criar_tecnico_automaticamente
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_tecnico_automaticamente();