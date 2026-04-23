import { useQuery } from '@tanstack/react-query';
import { clientService } from '@/features/clients/services/clientService';
import { technicianService } from '@/features/technicians/services/technicianService';
import { providerService } from '@/features/providers/services/providerService';
import type { TicketCliente, TicketPrestador } from '@/features/tickets/types';
import type { Tecnico } from '@/features/technicians/types';

/** Shared query keys */
export const queryKeys = {
  clientes: ['clientes'] as const,
  tecnicos: ['tecnicos'] as const,
  prestadores: ['prestadores'] as const,
  ticketClientes: ['ticket-clientes'] as const,
  ticketPrestadores: ['ticket-prestadores'] as const,
} as const;

/**
 * Clientes (paginated). The clients page now uses paged data, so this hook
 * loads only the first page for shared selectors. Pass a larger pageSize when
 * a select/dropdown needs more options.
 */
export function useClientesQuery(pageSize: number = 200) {
  return useQuery({
    queryKey: [...queryKeys.clientes, 'page-1', pageSize] as const,
    queryFn: async () => (await clientService.fetchPage({ page: 1, pageSize })).rows,
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

/** Técnicos — changes infrequently */
export function useTecnicosQuery(enabled = true) {
  return useQuery<Tecnico[]>({
    queryKey: queryKeys.tecnicos,
    queryFn: () => technicianService.fetchAll() as Promise<Tecnico[]>,
    staleTime: 1000 * 60 * 10,
    enabled,
  });
}

/** Prestadores ativos — changes infrequently */
export function usePrestadoresQuery() {
  return useQuery({
    queryKey: queryKeys.prestadores,
    queryFn: () => providerService.fetchAll(),
    staleTime: 1000 * 60 * 10,
  });
}
