import { useState, useEffect, useMemo } from 'react';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { workOrderService } from '../services/workOrderService';
import type { WorkOrder } from '../types';
import { ITEMS_PER_PAGE } from '../types';

export const useWorkOrderData = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [clientes, setClientes] = useState<{ id: string; empresa: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleAsyncError } = useErrorHandler();

  const loadWorkOrders = async () => {
    setLoading(true);
    const data = await handleAsyncError(
      () => workOrderService.loadAll(),
      { fallbackMessage: 'Erro ao carregar ordens de serviço' }
    );
    if (data) setWorkOrders(data);
    setLoading(false);
  };

  const loadClientes = async () => {
    const data = await workOrderService.loadClientes();
    setClientes(data);
  };

  useEffect(() => { loadWorkOrders(); loadClientes(); }, []);

  // Realtime: refresh stats/listing when OS, tickets or RME status change
  useGlobalRealtime(() => { loadWorkOrders(); });

  const ufvSolarzOptions = useMemo(() => {
    const ufvSet = new Set<string>();
    workOrders.forEach(os => {
      if (os.tickets.clientes?.ufv_solarz) ufvSet.add(os.tickets.clientes.ufv_solarz);
    });
    return Array.from(ufvSet).sort();
  }, [workOrders]);

  const stats = useMemo(() => {
    const total = workOrders.length;
    const abertas = workOrders.filter(os => !["concluido", "cancelado", "em_execucao"].includes(os.tickets.status)).length;
    const emExecucao = workOrders.filter(os => os.tickets.status === "em_execucao").length;
    const atrasadas = workOrders.filter(os => {
      if (!os.data_programada) return false;
      return new Date(os.data_programada) < new Date() && !["concluido", "cancelado"].includes(os.tickets.status);
    }).length;
    const concluidas = workOrders.filter(os => os.tickets.status === "concluido").length;
    const recusadas = workOrders.filter(os => os.aceite_tecnico === "recusado").length;
    return { total, abertas, emExecucao, atrasadas, concluidas, recusadas };
  }, [workOrders]);

  return { workOrders, clientes, loading, setLoading, loadWorkOrders, ufvSolarzOptions, stats };
};

export const useWorkOrderFilters = (workOrders: WorkOrder[]) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aceiteFilter, setAceiteFilter] = useState<string>("all");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [ufvSolarzFilter, setUfvSolarzFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [currentPage, setCurrentPage] = useState(1);

  const filteredOrders = useMemo(() => {
    return workOrders.filter((os) => {
      const matchesSearch =
        searchTerm === "" ||
        os.numero_os.toLowerCase().includes(searchTerm.toLowerCase()) ||
        os.tickets.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        os.tickets.clientes?.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        os.site_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const ticketStatus = os.tickets.status;
      const osStatus =
        ticketStatus === "concluido" ? "concluida" :
        ticketStatus === "em_execucao" ? "em_execucao" :
        ticketStatus === "cancelado" ? "cancelada" : "aberta";

      const matchesStatus = statusFilter === "all" || osStatus === statusFilter;
      const matchesCliente = clienteFilter === "all" || os.tickets.clientes?.empresa === clienteFilter;
      const matchesUfvSolarz = ufvSolarzFilter === "all" || os.tickets.clientes?.ufv_solarz === ufvSolarzFilter;
      const matchesAceite = aceiteFilter === "all" || os.aceite_tecnico === aceiteFilter;
      const matchesDate =
        (!dateRange.from || new Date(os.data_programada || os.data_emissao) >= dateRange.from) &&
        (!dateRange.to || new Date(os.data_programada || os.data_emissao) <= dateRange.to);

      return matchesSearch && matchesStatus && matchesCliente && matchesUfvSolarz && matchesAceite && matchesDate;
    });
  }, [workOrders, searchTerm, statusFilter, aceiteFilter, clienteFilter, ufvSolarzFilter, dateRange]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, aceiteFilter, clienteFilter, ufvSolarzFilter, dateRange]);

  return {
    searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    aceiteFilter, setAceiteFilter, clienteFilter, setClienteFilter,
    ufvSolarzFilter, setUfvSolarzFilter, dateRange, setDateRange,
    currentPage, setCurrentPage, filteredOrders, paginatedOrders, totalPages,
  };
};
