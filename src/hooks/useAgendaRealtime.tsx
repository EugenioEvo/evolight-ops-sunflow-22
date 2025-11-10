import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAgendaRealtimeProps {
  onUpdate?: () => void;
  selectedDate?: Date;
}

export const useAgendaRealtime = ({ onUpdate, selectedDate }: UseAgendaRealtimeProps = {}) => {
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('ordens_servico_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordens_servico'
        },
        (payload) => {
          console.log('[Realtime] Mudança detectada em ordens_servico:', payload);
          
          // Notificar usuário sobre mudanças
          if (payload.eventType === 'INSERT') {
            toast({
              title: '📅 Nova OS agendada',
              description: 'Uma nova ordem de serviço foi adicionada à agenda',
            });
          } else if (payload.eventType === 'UPDATE') {
            const old = payload.old as any;
            const newData = payload.new as any;
            
            // Detectar mudanças relevantes
            if (old.data_programada !== newData.data_programada || 
                old.hora_inicio !== newData.hora_inicio) {
              toast({
                title: '🔄 Agenda atualizada',
                description: `OS ${newData.numero_os} foi reagendada`,
              });
            }
            
            if (old.calendar_invite_sent_at !== newData.calendar_invite_sent_at && newData.calendar_invite_sent_at) {
              toast({
                title: '✉️ Convite enviado',
                description: `Convite de calendário enviado para OS ${newData.numero_os}`,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            toast({
              title: '❌ OS cancelada',
              description: 'Uma ordem de serviço foi removida da agenda',
              variant: 'destructive'
            });
          }

          // Recarregar dados
          if (onUpdate) {
            onUpdate();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status da conexão:', status);
      });

    return () => {
      console.log('[Realtime] Desconectando canal');
      supabase.removeChannel(channel);
    };
  }, [onUpdate, selectedDate, toast]);
};
