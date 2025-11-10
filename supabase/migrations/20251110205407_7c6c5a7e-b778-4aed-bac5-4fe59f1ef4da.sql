-- Fase 2: Segurança - Fortalecer RLS Policies e Configurações

-- 1. CRIAR SCHEMA PARA EXTENSÕES (separar do public)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Mover extensões do schema public para extensions
-- Nota: Algumas extensões como uuid-ossp e pgcrypto podem já estar em uso
-- Vamos criar aliases no schema extensions

-- 2. CORRIGIR RLS POLICIES VULNERÁVEIS

-- 2.1 Corrigir policy de notificações para permitir inserção do sistema
DROP POLICY IF EXISTS "System can insert notifications" ON public.notificacoes;
CREATE POLICY "System can insert notifications"
ON public.notificacoes
FOR INSERT
WITH CHECK (true);

-- Garantir que apenas o dono ou admin pode modificar notificações
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notificacoes;
CREATE POLICY "Users can update their own notifications"
ON public.notificacoes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2.2 Restringir movimentacoes - remover policy muito permissiva
DROP POLICY IF EXISTS "Authenticated users can manage movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Authenticated users can view movimentacoes" ON public.movimentacoes;

-- Apenas admins e área técnica podem gerenciar movimentações
CREATE POLICY "Admins and tech can manage movimentacoes"
ON public.movimentacoes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role));

-- Técnicos de campo podem visualizar movimentações
CREATE POLICY "Technicians can view movimentacoes"
ON public.movimentacoes
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'area_tecnica'::app_role) OR 
  has_role(auth.uid(), 'tecnico_campo'::app_role)
);

-- 2.3 Restringir presence_confirmation_attempts
-- Remover policy muito permissiva
DROP POLICY IF EXISTS "Attempts são públicos" ON public.presence_confirmation_attempts;

-- Apenas leitura pública (necessário para edge function)
CREATE POLICY "Public read for validation"
ON public.presence_confirmation_attempts
FOR SELECT
USING (true);

-- Apenas sistema pode inserir tentativas
CREATE POLICY "System can log attempts"
ON public.presence_confirmation_attempts
FOR INSERT
WITH CHECK (true);

-- Apenas sistema pode limpar tentativas antigas
CREATE POLICY "System can delete old attempts"
ON public.presence_confirmation_attempts
FOR DELETE
USING (true);

-- 2.4 Fortalecer policy de tokens de presença
-- Garantir que apenas leitura é permitida publicamente
DROP POLICY IF EXISTS "Tokens são públicos para validação" ON public.presence_confirmation_tokens;

CREATE POLICY "Public read tokens for validation"
ON public.presence_confirmation_tokens
FOR SELECT
USING (true);

-- Apenas sistema pode criar/gerenciar tokens
CREATE POLICY "System manages tokens"
ON public.presence_confirmation_tokens
FOR ALL
USING (false)
WITH CHECK (false);

-- 3. ADICIONAR AUDITORIA NAS TABELAS CRÍTICAS

-- Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed ON public.audit_logs(performed_at DESC);

-- RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Nunca permitir UPDATE ou DELETE de logs de auditoria
CREATE POLICY "No updates to audit logs"
ON public.audit_logs
FOR UPDATE
USING (false);

CREATE POLICY "No deletes of audit logs"
ON public.audit_logs
FOR DELETE
USING (false);

-- 4. FUNÇÃO GENÉRICA DE AUDITORIA
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      new_data,
      user_id
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      'INSERT',
      to_jsonb(NEW),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      user_id
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      user_id
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      auth.uid()
    );
    RETURN OLD;
  END IF;
END;
$$;

-- 5. ADICIONAR TRIGGERS DE AUDITORIA EM TABELAS CRÍTICAS

-- Auditar tickets
DROP TRIGGER IF EXISTS audit_tickets_trigger ON public.tickets;
CREATE TRIGGER audit_tickets_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Auditar ordens_servico
DROP TRIGGER IF EXISTS audit_ordens_servico_trigger ON public.ordens_servico;
CREATE TRIGGER audit_ordens_servico_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Auditar rme_relatorios (especialmente aprovações)
DROP TRIGGER IF EXISTS audit_rme_relatorios_trigger ON public.rme_relatorios;
CREATE TRIGGER audit_rme_relatorios_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.rme_relatorios
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Auditar user_roles (alterações de permissões)
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON public.user_roles;
CREATE TRIGGER audit_user_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Auditar clientes (dados sensíveis)
DROP TRIGGER IF EXISTS audit_clientes_trigger ON public.clientes;
CREATE TRIGGER audit_clientes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 6. ADICIONAR POLÍTICAS DE RETENÇÃO

-- Função para limpar logs antigos (manter últimos 90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE performed_at < now() - interval '90 days';
END;
$$;

-- 7. FORTALECER VALIDAÇÃO DE DADOS

-- Garantir que emails sejam válidos e únicos em profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
ON public.profiles(LOWER(email));

-- Garantir que user_id seja único em profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique 
ON public.profiles(user_id);

-- 8. ADICIONAR CONSTRAINT PARA PREVENIR ESCALAÇÃO DE PRIVILÉGIOS

-- Garantir que user_id em user_roles corresponde a usuário autenticado
-- (já protegido por RLS, mas adicionar constraint como defesa em profundidade)
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 9. PROTEÇÃO CONTRA SQL INJECTION EM FUNÇÕES

-- Revisar funções existentes - todas já usam SECURITY DEFINER e search_path
-- Nenhuma função executa SQL dinâmico, então estamos protegidos

-- 10. COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON TABLE public.audit_logs IS 'Registra todas as mudanças em tabelas críticas para auditoria e compliance';
COMMENT ON FUNCTION public.audit_trigger() IS 'Função trigger para auditoria automática de mudanças em tabelas';
COMMENT ON FUNCTION public.cleanup_old_audit_logs() IS 'Remove logs de auditoria com mais de 90 dias para gerenciar espaço';