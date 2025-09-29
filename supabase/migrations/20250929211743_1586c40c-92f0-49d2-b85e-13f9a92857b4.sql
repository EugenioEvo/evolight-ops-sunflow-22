-- Create the get_user_role function first
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Create prestadores table
CREATE TABLE public.prestadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cpf TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  categoria TEXT NOT NULL,
  especialidades TEXT[],
  certificacoes TEXT[],
  experiencia INTEGER,
  salario NUMERIC,
  data_admissao DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create equipamentos table
CREATE TABLE public.equipamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  modelo TEXT,
  fabricante TEXT,
  numero_serie TEXT,
  tipo equipamento_tipo NOT NULL,
  capacidade TEXT,
  tensao TEXT,
  corrente TEXT,
  data_instalacao DATE,
  garantia TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  localizacao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies for prestadores
CREATE POLICY "Authenticated users can view prestadores"
ON public.prestadores
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and technical area can manage prestadores"
ON public.prestadores
FOR ALL
USING (public.get_user_role(auth.uid()) IN ('admin', 'area_tecnica'));

-- RLS policies for equipamentos
CREATE POLICY "Users can view equipamentos"
ON public.equipamentos
FOR SELECT
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'area_tecnica') OR
  EXISTS (
    SELECT 1 FROM clientes c 
    JOIN profiles p ON p.id = c.profile_id 
    WHERE c.id = equipamentos.cliente_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins and technical area can manage equipamentos"
ON public.equipamentos
FOR ALL
USING (public.get_user_role(auth.uid()) IN ('admin', 'area_tecnica'));

CREATE POLICY "Clients can manage their equipamentos"
ON public.equipamentos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM clientes c 
    JOIN profiles p ON p.id = c.profile_id 
    WHERE c.id = equipamentos.cliente_id AND p.user_id = auth.uid()
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_prestadores_updated_at
  BEFORE UPDATE ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_equipamentos_updated_at
  BEFORE UPDATE ON public.equipamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();