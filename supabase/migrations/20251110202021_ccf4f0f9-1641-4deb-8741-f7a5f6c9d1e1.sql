-- Adicionar campo para rastrear envio de lembretes
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;