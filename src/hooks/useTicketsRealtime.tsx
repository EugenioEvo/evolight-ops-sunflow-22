import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseTicketsRealtimeProps {
  onTicketChange?: () => void;
}

export const useTicketsRealtime = ({ onTicketChange }: UseTicketsRealtimeProps = {}) => {
  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('Ticket change:', payload);
          onTicketChange?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordens_servico'
        },
        (payload) => {
          console.log('OS change:', payload);
          onTicketChange?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rme_relatorios'
        },
        (payload) => {
          console.log('RME change:', payload);
          onTicketChange?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onTicketChange]);
};
