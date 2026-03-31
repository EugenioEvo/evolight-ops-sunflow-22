import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { ITEMS_PER_PAGE, type TicketWithRelations } from '../types';

export const useTicketFilters = (tickets: TicketWithRelations[]) => {
  const [searchTerm, setSearchTerm] = useState(localStorage.getItem('tickets_search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('tickets_tab') || 'todos');
  const [selectedCliente, setSelectedCliente] = useState(localStorage.getItem('tickets_cliente') || 'todos');
  const [selectedPrioridade, setSelectedPrioridade] = useState(localStorage.getItem('tickets_prioridade') || 'todas');
  const [selectedUfvSolarz, setSelectedUfvSolarz] = useState(localStorage.getItem('tickets_ufv_solarz') || 'todos');
  const [currentPage, setCurrentPage] = useState(1);

  // Persist filters
  useEffect(() => {
    localStorage.setItem('tickets_search', searchTerm);
    localStorage.setItem('tickets_tab', activeTab);
    localStorage.setItem('tickets_cliente', selectedCliente);
    localStorage.setItem('tickets_prioridade', selectedPrioridade);
    localStorage.setItem('tickets_ufv_solarz', selectedUfvSolarz);
  }, [searchTerm, activeTab, selectedCliente, selectedPrioridade, selectedUfvSolarz]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const clienteNome = ticket.clientes?.empresa || ticket.clientes?.profiles?.nome || '';
      const matchesSearch = ticket.titulo.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        ticket.numero_ticket.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        clienteNome.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

      const matchesCliente = selectedCliente === 'todos' || ticket.cliente_id === selectedCliente;
      const matchesPrioridade = selectedPrioridade === 'todas' || ticket.prioridade === selectedPrioridade;
      const matchesUfvSolarz = selectedUfvSolarz === 'todos' || ticket.clientes?.ufv_solarz === selectedUfvSolarz;

      if (activeTab === 'todos') return matchesSearch && matchesCliente && matchesPrioridade && matchesUfvSolarz;
      return matchesSearch && matchesCliente && matchesPrioridade && matchesUfvSolarz && ticket.status === activeTab;
    });
  }, [tickets, debouncedSearchTerm, activeTab, selectedCliente, selectedPrioridade, selectedUfvSolarz]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, activeTab, selectedCliente, selectedPrioridade, selectedUfvSolarz]);

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    activeTab,
    setActiveTab,
    selectedCliente,
    setSelectedCliente,
    selectedPrioridade,
    setSelectedPrioridade,
    selectedUfvSolarz,
    setSelectedUfvSolarz,
    currentPage,
    setCurrentPage,
    filteredTickets,
    paginatedTickets,
    totalPages,
  };
};
