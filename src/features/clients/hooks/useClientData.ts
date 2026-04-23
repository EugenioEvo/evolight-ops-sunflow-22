import { useCallback, useEffect, useMemo, useState } from 'react';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useDebounce } from '@/hooks/useDebounce';
import { clientService } from '../services/clientService';
import { PAGE_SIZE, type Cliente } from '../types';

export interface UseClientDataResult {
  clientes: Cliente[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  refetch: () => Promise<void>;
}

export function useClientData(pageSize: number = PAGE_SIZE): UseClientDataResult {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { handleAsyncError } = useErrorHandler();

  const debouncedSearch = useDebounce(searchTerm, 350);

  // Whenever the search term changes, reset to page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    const data = await handleAsyncError(
      () =>
        clientService.fetchPage({
          page,
          pageSize,
          search: debouncedSearch,
        }),
      { fallbackMessage: 'Erro ao carregar clientes' },
    );
    if (data) {
      setClientes(data.rows);
      setTotalCount(data.total);
    }
    setLoading(false);
  }, [debouncedSearch, handleAsyncError, page, pageSize]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [pageSize, totalCount],
  );

  return {
    clientes,
    loading,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    pageSize,
    totalCount,
    totalPages,
    refetch: fetchPage,
  };
}
