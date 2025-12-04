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
        () => {
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
        () => {
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
        () => {
          onTicketChange?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onTicketChange]);
};
