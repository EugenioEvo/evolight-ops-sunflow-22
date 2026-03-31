import { useState, useEffect, useMemo } from 'react';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ticketService } from '../services/ticketService';
import type { TicketWithRelations, TicketCliente, TicketPrestador } from '../types';

export const useTicketData = () => {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [clientes, setClientes] = useState<TicketCliente[]>([]);
  const [prestadores, setPrestadores] = useState<TicketPrestador[]>([]);
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
      .map(c => c.ufv_solarz)
      .filter((ufv): ufv is string => ufv !== null && ufv !== undefined && ufv.trim() !== '')
      .filter((ufv, index, arr) => arr.indexOf(ufv) === index)
      .sort((a, b) => a.localeCompare(b));
  }, [clientes]);

  return { tickets, clientes, prestadores, loading, setLoading, loadData, ufvSolarzOptions, ufvSolarzListForForm };
};
