import { useCallback, useEffect, useState } from 'react';
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
  const [ordensServico, setOrdensServico] = useState<any[]>([]);
  const [obras, setObras] = useState<any[]>([]);
  const [rdos, setRdos] = useState<any[]>([]);
  const [stats, setStats] = useState<ClientDashStats>({ total: 0, abertos: 0, emExecucao: 0, concluidos: 0 });
  const { handleAsyncError } = useErrorHandler();

  const loadClientData = useCallback(async () => {
    if (!user || !profile?.id) return;
    setLoading(true);
    await handleAsyncError(async () => {
      const clienteData = await service.fetchClientByProfile(profile.id);
      setCliente(clienteData);
      if (!clienteData) return;

      const [ticketsData, equipamentosData, osData, obrasData] = await Promise.all([
        service.fetchClientTickets(clienteData.id),
        service.fetchClientEquipments(clienteData.id),
        service.fetchClientOrdensServico(clienteData.id),
        service.fetchClientObras(clienteData.id),
      ]);

      setTickets(ticketsData);
      setEquipamentos(equipamentosData);
      setOrdensServico(osData);
      setObras(obrasData);

      const total = ticketsData.length;
      const abertos = ticketsData.filter((t: any) => ['aberto', 'aguardando_aprovacao', 'aprovado', 'ordem_servico_gerada'].includes(t.status)).length;
      const emExecucao = ticketsData.filter((t: any) => t.status === 'em_execucao').length;
      const concluidos = ticketsData.filter((t: any) => t.status === 'concluido').length;
      setStats({ total, abertos, emExecucao, concluidos });

      if (ticketsData.length > 0) {
        const ticketIds = ticketsData.map((t: any) => t.id);
        const rmesData = await service.fetchClientRMEs(ticketIds);
        setRmes(rmesData);
      } else {
        setRmes([]);
      }

      if (obrasData.length > 0) {
        const rdosData = await service.fetchClientRDOs(obrasData.map((o: any) => o.id));
        setRdos(rdosData);
      } else {
        setRdos([]);
      }
    }, { fallbackMessage: 'Erro ao carregar dados' });
    setLoading(false);
  }, [user, profile?.id, service, handleAsyncError]);

  useEffect(() => { loadClientData(); }, [loadClientData]);

  useGlobalRealtime(() => { loadClientData(); });

  return {
    loading,
    cliente,
    tickets,
    equipamentos,
    rmes,
    ordensServico,
    obras,
    rdos,
    stats,
    refresh: loadClientData,
  };
};
