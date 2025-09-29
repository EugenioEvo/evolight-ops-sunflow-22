-- Create table for responsible persons
CREATE TABLE public.responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('funcionario', 'prestador', 'fornecedor')),
  contato TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for insumos with proper schema
CREATE TABLE public.insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('medicamentos', 'equipamentos', 'suprimentos', 'limpeza')),
  quantidade INTEGER NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'unidade',
  preco DECIMAL(10,2),
  estoque_minimo INTEGER DEFAULT 10,
  estoque_critico INTEGER DEFAULT 5,
  localizacao TEXT,
  fornecedor TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for movements (entrada/saida)
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES public.responsaveis(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  motivo TEXT,
  observacoes TEXT,
  data_movimentacao TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (for now allowing read access to all authenticated users)
CREATE POLICY "Authenticated users can view responsaveis" 
ON public.responsaveis FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage responsaveis" 
ON public.responsaveis FOR ALL 
TO authenticated USING (true);

CREATE POLICY "Authenticated users can view insumos" 
ON public.insumos FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage insumos" 
ON public.insumos FOR ALL 
TO authenticated USING (true);

CREATE POLICY "Authenticated users can view movimentacoes" 
ON public.movimentacoes FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage movimentacoes" 
ON public.movimentacoes FOR ALL 
TO authenticated USING (true);

-- Create function to update stock on movements
CREATE OR REPLACE FUNCTION public.atualizar_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.insumos 
    SET quantidade = quantidade + NEW.quantidade,
        updated_at = now()
    WHERE id = NEW.insumo_id;
  ELSIF NEW.tipo = 'saida' THEN
    UPDATE public.insumos 
    SET quantidade = quantidade - NEW.quantidade,
        updated_at = now()
    WHERE id = NEW.insumo_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic stock updates
CREATE TRIGGER trigger_atualizar_estoque
  AFTER INSERT ON public.movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_estoque();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_insumos_updated_at
  BEFORE UPDATE ON public.insumos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample data
INSERT INTO public.responsaveis (nome, tipo, contato) VALUES
('João Silva', 'funcionario', 'joao@empresa.com'),
('Maria Santos', 'funcionario', 'maria@empresa.com'),
('Prestador ABC', 'prestador', 'contato@abc.com'),
('Fornecedor XYZ', 'fornecedor', 'vendas@xyz.com');

INSERT INTO public.insumos (nome, categoria, quantidade, unidade, preco, estoque_minimo, estoque_critico, localizacao, fornecedor) VALUES
('Paracetamol 500mg', 'medicamentos', 100, 'caixa', 15.50, 20, 10, 'Estoque A1', 'Farmácia Brasil'),
('Seringa 10ml', 'equipamentos', 50, 'unidade', 2.30, 30, 15, 'Estoque B2', 'Medic Supply'),
('Álcool 70%', 'limpeza', 25, 'litro', 8.90, 10, 5, 'Estoque C1', 'Química Limpa'),
('Gaze Estéril', 'suprimentos', 80, 'pacote', 12.40, 25, 10, 'Estoque A2', 'Med Suprimentos');