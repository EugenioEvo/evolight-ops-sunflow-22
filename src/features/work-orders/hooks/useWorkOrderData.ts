import { useState, useEffect, useCallback, useRef } from 'react';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { useDebounce } from '@/hooks/useDebounce';
import { workOrderService } from '../services/workOrderService';
import type { WorkOrder } from '../types';
import { ITEMS_PER_PAGE } from '../types';

/** Filter state for the OS list. Filtering runs in the database. */
export const useWorkOrderFilters = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aceiteFilter, setAceiteFilter] = useState<string>("all");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [ufvSolarzFilter, setUfvSolarzFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, aceiteFilter, clienteFilter, ufvSolarzFilter, dateRange]);

  return {
    searchTerm, setSearchTerm, debouncedSearch, statusFilter, setStatusFilter,
    aceiteFilter, setAceiteFilter, clienteFilter, setClienteFilter,
    ufvSolarzFilter, setUfvSolarzFilter, dateRange, setDateRange,
    currentPage, setCurrentPage,
  };
};

export type WorkOrderFiltersState = ReturnType<typeof useWorkOrderFilters>;

export const useWorkOrderData = (filters: WorkOrderFiltersState) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [clientes, setClientes] = useState<{ id: string; empresa: string }[]>([]);
  const [ufvSolarzOptions, setUfvSolarzOptions] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, abertas: 0, emExecucao: 0, atrasadas: 0, concluidas: 0, recusadas: 0 });
  const [loading, setLoading] = useState(true);
  const { handleAsyncError } = useErrorHandler();
  const reqId = useRef(0);

  const { currentPage, debouncedSearch, statusFilter, aceiteFilter, clienteFilter, ufvSolarzFilter, dateRange } = filters;

  const loadWorkOrders = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    const [page, s] = await Promise.all([
      handleAsyncError(() => workOrderService.loadPage({
        page: currentPage, pageSize: ITEMS_PER_PAGE, search: debouncedSearch,
        status: statusFilter, aceite: aceiteFilter, clienteEmpresa: clienteFilter,
        ufv: ufvSolarzFilter, dateFrom: dateRange.from, dateTo: dateRange.to,
      }), { fallbackMessage: 'Erro ao carregar ordens de serviço' }),
      workOrderService.loadStats().catch(() => null),
    ]);
    if (id !== reqId.current) return;
    if (page) { setWorkOrders(page.rows); setTotalCount(page.total); }
    if (s) setStats(s);
    setLoading(false);
  }, [currentPage, debouncedSearch, statusFilter, aceiteFilter, clienteFilter, ufvSolarzFilter, dateRange, handleAsyncError]);

  useEffect(() => {
    workOrderService.loadClientes().then(setClientes);
    workOrderService.loadUfvNames().then(setUfvSolarzOptions);
  }, []);
  useEffect(() => { loadWorkOrders(); }, [loadWorkOrders]);
  useGlobalRealtime(loadWorkOrders);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  return { workOrders, totalCount, totalPages, clientes, loading, setLoading, loadWorkOrders, ufvSolarzOptions, stats };
};
