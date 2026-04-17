import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { clientService as defaultClientService } from '../../clients/services/clientService';

interface ClientDashStats {
  total: number;
  abertos: number;
  emExecucao: number;
  concluidos: number;
}

export const useClientDashData = (service = defaultClientService) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [rmes, setRmes] = useState<any[]>([]);
  const [stats, setStats] = useState<ClientDashStats>({ total: 0, abertos: 0, emExecucao: 0, concluidos: 0 });
  const { handleAsyncError } = useErrorHandler();

  useEffect(() => { loadClientData(); }, [user]);

  // Realtime: refresh when tickets/OS/RME change
  useGlobalRealtime(() => { loadClientData(); });

  const loadClientData = async () => {
    if (!user || !profile?.id) return;
    setLoading(true);
    await handleAsyncError(async () => {
      const clienteData = await service.fetchClientByProfile(profile.id);
      setCliente(clienteData);
      if (!clienteData) return;

      const ticketsData = await service.fetchClientTickets(clienteData.id);
      setTickets(ticketsData);

      const total = ticketsData.length;
      const abertos = ticketsData.filter((t: any) => ['aberto', 'aprovado', 'ordem_servico_gerada'].includes(t.status)).length;
      const emExecucao = ticketsData.filter((t: any) => t.status === 'em_execucao').length;
      const concluidos = ticketsData.filter((t: any) => t.status === 'concluido').length;
      setStats({ total, abertos, emExecucao, concluidos });

      const equipamentosData = await service.fetchClientEquipments(clienteData.id);
      setEquipamentos(equipamentosData);

      if (ticketsData.length > 0) {
        const ticketIds = ticketsData.map((t: any) => t.id);
        const rmesData = await service.fetchClientRMEs(ticketIds);
        setRmes(rmesData);
      }
    }, { fallbackMessage: 'Erro ao carregar dados' });
    setLoading(false);
  };

  return { loading, cliente, tickets, equipamentos, rmes, stats };
};
