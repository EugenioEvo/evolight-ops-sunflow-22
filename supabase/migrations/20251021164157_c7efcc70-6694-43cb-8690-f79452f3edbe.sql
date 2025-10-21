-- Criar tabela de notificações
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_notificacoes_user_id ON public.notificacoes(user_id);
CREATE INDEX idx_notificacoes_lida ON public.notificacoes(lida);
CREATE INDEX idx_notificacoes_created_at ON public.notificacoes(created_at DESC);

-- Enable RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own notifications"
ON public.notificacoes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notificacoes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can create notifications"
ON public.notificacoes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'area_tecnica'::app_role)
);

CREATE POLICY "Users can delete their own notifications"
ON public.notificacoes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger para criar notificação quando RME for aprovado/rejeitado
CREATE OR REPLACE FUNCTION public.notify_rme_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tecnico_user_id UUID;
  v_titulo TEXT;
  v_mensagem TEXT;
BEGIN
  SELECT p.user_id INTO v_tecnico_user_id
  FROM tecnicos t
  JOIN profiles p ON p.id = t.profile_id
  WHERE t.id = NEW.tecnico_id;
  
  IF v_tecnico_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status_aprovacao = 'aprovado' THEN
    v_titulo := 'RME Aprovado';
    v_mensagem := 'Seu relatório de manutenção foi aprovado!';
    
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (
      v_tecnico_user_id,
      'rme_aprovado',
      v_titulo,
      v_mensagem,
      '/gerenciar-rme'
    );
  ELSIF NEW.status_aprovacao = 'rejeitado' THEN
    v_titulo := 'RME Rejeitado';
    v_mensagem := 'Seu relatório de manutenção foi rejeitado. Revise e reenvie.';
    
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (
      v_tecnico_user_id,
      'rme_rejeitado',
      v_titulo,
      v_mensagem,
      '/rme?os=' || NEW.ordem_servico_id::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_rme_status
AFTER UPDATE OF status_aprovacao ON public.rme_relatorios
FOR EACH ROW
WHEN (OLD.status_aprovacao IS DISTINCT FROM NEW.status_aprovacao)
EXECUTE FUNCTION public.notify_rme_status_change();

-- Trigger para notificar quando OS for atribuída
CREATE OR REPLACE FUNCTION public.notify_os_atribuida()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tecnico_user_id UUID;
BEGIN
  SELECT p.user_id INTO v_tecnico_user_id
  FROM tecnicos t
  JOIN profiles p ON p.id = t.profile_id
  WHERE t.id = NEW.tecnico_id;
  
  IF v_tecnico_user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (
      v_tecnico_user_id,
      'os_atribuida',
      'Nova Ordem de Serviço',
      'Uma nova OS foi atribuída a você: ' || NEW.numero_os,
      '/minhas-os'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_os_atribuida
AFTER INSERT ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.notify_os_atribuida();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;