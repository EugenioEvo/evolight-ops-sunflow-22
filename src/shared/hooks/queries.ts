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

/** Clientes — changes infrequently */
export function useClientesQuery() {
  return useQuery({
    queryKey: queryKeys.clientes,
    queryFn: () => clientService.fetchAll(),
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
