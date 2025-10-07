-- Fase 1: Correção crítica do trigger de histórico de status
-- Permitir que alterado_por seja NULL em contexto de sistema (edge functions)
ALTER TABLE status_historico 
ALTER COLUMN alterado_por DROP NOT NULL;

-- Modificar trigger para usar created_by do ticket quando auth.uid() não estiver disponível
CREATE OR REPLACE FUNCTION public.trigger_status_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
      COALESCE(auth.uid(), NEW.created_by)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Adicionar colunas para controle de tempo de execução (Fase 3)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS data_inicio_execucao timestamp with time zone,
ADD COLUMN IF NOT EXISTS data_conclusao timestamp with time zone;

-- Criar índices para melhor performance (Fase 6)
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente_id ON tickets(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tecnico_responsavel_id ON tickets(tecnico_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tickets_data_abertura ON tickets(data_abertura);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_ticket_id ON ordens_servico(ticket_id);
CREATE INDEX IF NOT EXISTS idx_rme_relatorios_ticket_id ON rme_relatorios(ticket_id);

-- Habilitar realtime para tickets (Fase 6)
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE rme_relatorios;