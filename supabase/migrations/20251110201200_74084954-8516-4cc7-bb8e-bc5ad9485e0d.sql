-- Adicionar campos para rastreamento de convites de calendário
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS calendar_invite_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS calendar_invite_recipients TEXT[];