import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

/** Filter state for the tickets list. Filtering itself runs in the database. */
export const useTicketFilters = () => {
  const [searchTerm, setSearchTerm] = useState(localStorage.getItem('tickets_search') || '');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('tickets_tab') || 'todos');
  const [selectedCliente, setSelectedCliente] = useState(localStorage.getItem('tickets_cliente') || 'todos');
  const [selectedPrioridade, setSelectedPrioridade] = useState(localStorage.getItem('tickets_prioridade') || 'todas');
  const [selectedUfvSolarz, setSelectedUfvSolarz] = useState(localStorage.getItem('tickets_ufv_solarz') || 'todos');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    localStorage.setItem('tickets_search', searchTerm);
    localStorage.setItem('tickets_tab', activeTab);
    localStorage.setItem('tickets_cliente', selectedCliente);
    localStorage.setItem('tickets_prioridade', selectedPrioridade);
    localStorage.setItem('tickets_ufv_solarz', selectedUfvSolarz);
  }, [searchTerm, activeTab, selectedCliente, selectedPrioridade, selectedUfvSolarz]);

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
  };
};

export type TicketFiltersState = ReturnType<typeof useTicketFilters>;
