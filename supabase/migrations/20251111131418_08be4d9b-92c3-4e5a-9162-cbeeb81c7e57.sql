-- Adicionar campos de assinatura digital na tabela ordens_servico
ALTER TABLE public.ordens_servico
ADD COLUMN assinatura_tecnico TEXT,
ADD COLUMN assinatura_cliente TEXT,
ADD COLUMN nome_cliente_assinatura TEXT,
ADD COLUMN data_assinatura_tecnico TIMESTAMP WITH TIME ZONE,
ADD COLUMN data_assinatura_cliente TIMESTAMP WITH TIME ZONE;