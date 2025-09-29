-- Criar enum para tipos de usuário
CREATE TYPE public.user_role AS ENUM ('admin', 'tecnico_campo', 'area_tecnica', 'cliente');

-- Criar enum para status de tickets
CREATE TYPE public.ticket_status AS ENUM (
  'aberto',
  'aguardando_aprovacao', 
  'aprovado',
  'rejeitado',
  'ordem_servico_gerada',
  'em_execucao',
  'aguardando_rme',
  'concluido',
  'cancelado'
);

-- Criar enum para tipos de prioridade
CREATE TYPE public.prioridade_tipo AS ENUM ('baixa', 'media', 'alta', 'critica');

-- Criar enum para tipos de equipamento
CREATE TYPE public.equipamento_tipo AS ENUM (
  'painel_solar',
  'inversor',
  'controlador_carga',
  'bateria',
  'cabeamento',
  'estrutura',
  'monitoramento',
  'outros'
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  role user_role NOT NULL DEFAULT 'cliente',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela de técnicos (estende profiles)
CREATE TABLE public.tecnicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registro_profissional TEXT,
  especialidades TEXT[],
  regiao_atuacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de clientes (estende profiles) 
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa TEXT,
  cnpj_cpf TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela principal de tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ticket TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  tecnico_responsavel_id UUID REFERENCES public.tecnicos(id),
  equipamento_tipo equipamento_tipo NOT NULL,
  prioridade prioridade_tipo NOT NULL DEFAULT 'media',
  status ticket_status NOT NULL DEFAULT 'aberto',
  endereco_servico TEXT NOT NULL,
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_vencimento TIMESTAMP WITH TIME ZONE,
  tempo_estimado INTEGER, -- em horas
  observacoes TEXT,
  anexos TEXT[], -- URLs dos arquivos no storage
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de aprovações
CREATE TABLE public.aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  aprovador_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL CHECK (status IN ('aprovado', 'rejeitado')),
  observacoes TEXT,
  data_aprovacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de ordens de serviço
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  numero_os TEXT NOT NULL UNIQUE,
  tecnico_id UUID NOT NULL REFERENCES public.tecnicos(id),
  data_emissao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_programada TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT, -- URL do PDF no storage
  qr_code TEXT, -- dados do QR code
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de RME (Relatório de Manutenção Elétrica)
CREATE TABLE public.rme_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id),
  tecnico_id UUID NOT NULL REFERENCES public.tecnicos(id),
  
  -- Dados técnicos
  condicoes_encontradas TEXT NOT NULL,
  servicos_executados TEXT NOT NULL,
  materiais_utilizados JSONB, -- lista de materiais e quantidades
  medicoes_eletricas JSONB, -- tensões, correntes, resistências etc
  testes_realizados TEXT,
  observacoes_tecnicas TEXT,
  
  -- Fotos e anexos
  fotos_antes TEXT[], -- URLs das fotos
  fotos_depois TEXT[],
  anexos_tecnicos TEXT[],
  
  -- Assinaturas
  assinatura_tecnico TEXT, -- base64 da assinatura
  assinatura_cliente TEXT,
  nome_cliente_assinatura TEXT,
  
  -- Status e datas
  data_execucao TIMESTAMP WITH TIME ZONE NOT NULL,
  data_preenchimento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pdf_url TEXT, -- URL do PDF gerado
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de histórico de status
CREATE TABLE public.status_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  status_anterior ticket_status,
  status_novo ticket_status NOT NULL,
  alterado_por UUID NOT NULL REFERENCES auth.users(id),
  observacoes TEXT,
  data_alteracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rme_relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Usuários podem ver e editar próprio perfil"
ON public.profiles
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os perfis"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Políticas RLS para tickets (baseadas no role do usuário)
CREATE POLICY "Clientes veem apenas seus tickets"
ON public.tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON c.profile_id = p.id
    WHERE p.user_id = auth.uid() AND c.id = tickets.cliente_id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica', 'tecnico_campo')
  )
);

CREATE POLICY "Clientes podem criar tickets"
ON public.tickets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON c.profile_id = p.id
    WHERE p.user_id = auth.uid() AND c.id = tickets.cliente_id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

CREATE POLICY "Área técnica e admins podem gerenciar tickets"
ON public.tickets
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'area_tecnica')
  )
);

-- Função para gerar número sequencial de ticket
CREATE OR REPLACE FUNCTION public.gerar_numero_ticket()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proximo_numero INTEGER;
  numero_formatado TEXT;
BEGIN
  -- Buscar o próximo número sequencial
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_ticket FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO proximo_numero
  FROM public.tickets
  WHERE numero_ticket ~ '^TK[0-9]+$';
  
  -- Formatar com zeros à esquerda
  numero_formatado := 'TK' || LPAD(proximo_numero::TEXT, 6, '0');
  
  RETURN numero_formatado;
END;
$$;

-- Função para gerar número sequencial de OS
CREATE OR REPLACE FUNCTION public.gerar_numero_os()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proximo_numero INTEGER;
  numero_formatado TEXT;
BEGIN
  -- Buscar o próximo número sequencial
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_os FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO proximo_numero
  FROM public.ordens_servico
  WHERE numero_os ~ '^OS[0-9]+$';
  
  -- Formatar com zeros à esquerda
  numero_formatado := 'OS' || LPAD(proximo_numero::TEXT, 6, '0');
  
  RETURN numero_formatado;
END;
$$;

-- Trigger para gerar número do ticket automaticamente
CREATE OR REPLACE FUNCTION public.trigger_gerar_numero_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_ticket IS NULL OR NEW.numero_ticket = '' THEN
    NEW.numero_ticket := public.gerar_numero_ticket();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_ticket_numero
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_gerar_numero_ticket();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tecnicos_updated_at
  BEFORE UPDATE ON public.tecnicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rme_relatorios_updated_at
  BEFORE UPDATE ON public.rme_relatorios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para registrar histórico de mudanças de status
CREATE OR REPLACE FUNCTION public.trigger_status_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.status_historico (
      ticket_id,
      status_anterior,
      status_novo,
      alterado_por
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_update_ticket_status
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_status_historico();