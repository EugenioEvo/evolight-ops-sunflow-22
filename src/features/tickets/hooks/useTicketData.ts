import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ticketService } from '../services/ticketService';

export const useTicketData = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { handleAsyncError } = useErrorHandler();

  const loadData = async () => {
    setLoading(true);
    await handleAsyncError(async () => {
      const [clientesData, prestadoresData, ticketsData] = await Promise.all([
        ticketService.loadClientes(),
        ticketService.loadPrestadores(),
        ticketService.loadAll(),
      ]);
      setClientes(clientesData);
      setPrestadores(prestadoresData);
      setTickets(ticketsData);
    }, { fallbackMessage: 'Erro ao carregar dados' });
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);
  useGlobalRealtime(loadData);

  const ufvSolarzOptions = useMemo(() => {
    const ufvSet = new Set<string>();
    tickets.forEach(ticket => {
      if (ticket.clientes?.ufv_solarz) ufvSet.add(ticket.clientes.ufv_solarz);
    });
    return Array.from(ufvSet).sort();
  }, [tickets]);

  const ufvSolarzListForForm = useMemo(() => {
    return clientes
      .map((c: any) => c.ufv_solarz)
      .filter((ufv: string | null): ufv is string => ufv !== null && ufv.trim() !== '')
      .filter((ufv: string, index: number, arr: string[]) => arr.indexOf(ufv) === index)
      .sort((a: string, b: string) => a.localeCompare(b));
  }, [clientes]);

  return { tickets, clientes, prestadores, loading, setLoading, loadData, ufvSolarzOptions, ufvSolarzListForForm };
};
