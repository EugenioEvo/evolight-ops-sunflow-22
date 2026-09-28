import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ticketService } from '../services/ticketService';
import { ITEMS_PER_PAGE, type TicketWithRelations, type TicketCliente, type TicketPrestador } from '../types';
import type { TicketFiltersState } from './useTicketFilters';

/**
 * Loads one page of tickets (server-side filters + pagination) plus the
 * reference lists used by the form. Reference lists load once; realtime
 * events only refresh the current page.
 */
export const useTicketData = (filters: TicketFiltersState) => {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [clientes, setClientes] = useState<TicketCliente[]>([]);
  const [prestadores, setPrestadores] = useState<TicketPrestador[]>([]);
  const [loading, setLoading] = useState(false);
  const { handleAsyncError } = useErrorHandler();
  const reqId = useRef(0);

  const { currentPage, activeTab, selectedCliente, selectedPrioridade, selectedUfvSolarz, debouncedSearchTerm } = filters;

  const loadPage = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    const res = await handleAsyncError(() => ticketService.loadPage({
      page: currentPage,
      pageSize: ITEMS_PER_PAGE,
      status: activeTab,
      clienteId: selectedCliente,
      prioridade: selectedPrioridade,
      ufv: selectedUfvSolarz,
      search: debouncedSearchTerm,
    }), { fallbackMessage: 'Erro ao carregar tickets' });
    if (id !== reqId.current) return; // stale response
    if (res) {
      setTickets(res.rows);
      setTotalCount(res.total);
      setStatusCounts(res.counts);
    }
    setLoading(false);
  }, [currentPage, activeTab, selectedCliente, selectedPrioridade, selectedUfvSolarz, debouncedSearchTerm, handleAsyncError]);

  const loadReference = useCallback(async () => {
    await handleAsyncError(async () => {
      const [c, p] = await Promise.all([ticketService.loadClientes(), ticketService.loadPrestadores()]);
      setClientes(c);
      setPrestadores(p);
    }, { fallbackMessage: 'Erro ao carregar dados' });
  }, [handleAsyncError]);

  useEffect(() => { loadReference(); }, [loadReference]);
  useEffect(() => { loadPage(); }, [loadPage]);
  useGlobalRealtime(loadPage);

  const ufvSolarzListForForm = useMemo(() => {
    return clientes
      .map(c => c.ufv_solarz)
      .filter((ufv): ufv is string => !!ufv && ufv.trim() !== '')
      .filter((ufv, i, arr) => arr.indexOf(ufv) === i)
      .sort((a, b) => a.localeCompare(b));
  }, [clientes]);

  // Individual UFV names, used by the server-side UFV filter
  const ufvSolarzOptions = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c: any) => (c.ufvs || []).forEach((u: any) => u?.nome && set.add(u.nome)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clientes]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  return {
    tickets,
    totalCount,
    totalPages,
    statusCounts,
    clientes,
    prestadores,
    loading,
    setLoading,
    loadData: loadPage,
    ufvSolarzOptions,
    ufvSolarzListForForm,
  };
};
