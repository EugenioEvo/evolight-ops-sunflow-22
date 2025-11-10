-- Adicionar campos para confirmação de presença
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS presence_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS presence_confirmed_by UUID REFERENCES auth.users(id);