import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAgendaRealtimeProps {
  onUpdate?: () => void;
  selectedDate?: Date;
}

export const useAgendaRealtime = ({ onUpdate, selectedDate }: UseAgendaRealtimeProps = {}) => {
  const { toast } = useToast();
  const onUpdateRef = useRef(onUpdate);

  // Keep ref in sync without triggering re-subscriptions
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    let pollInterval = 15000; // 15s initial poll
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Primary: realtime subscription
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
          if (payload.eventType === 'INSERT') {
            toast({
              title: '📅 Nova OS agendada',
              description: 'Uma nova ordem de serviço foi adicionada à agenda',
            });
          } else if (payload.eventType === 'UPDATE') {
            const old = payload.old as any;
            const newData = payload.new as any;
            
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

          // Reset poll interval when realtime works
          pollInterval = 15000;
          onUpdateRef.current?.();
        }
      )
      .subscribe();

    // Fallback: polling to catch any missed events
    const poll = () => {
      if (!isActive) return;
      onUpdateRef.current?.();
      pollInterval = Math.min(pollInterval * 1.2, 60000); // slowly back off up to 60s
      timeoutId = setTimeout(poll, pollInterval);
    };

    timeoutId = setTimeout(poll, pollInterval);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [selectedDate, toast]);
};
