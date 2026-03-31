import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ClientDashStats {
  total: number;
  abertos: number;
  emExecucao: number;
  concluidos: number;
}

export const useClientDashData = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [rmes, setRmes] = useState<any[]>([]);
  const [stats, setStats] = useState<ClientDashStats>({ total: 0, abertos: 0, emExecucao: 0, concluidos: 0 });

  useEffect(() => { loadClientData(); }, [user]);

  const loadClientData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*, profiles(nome, email, telefone)')
        .eq('profile_id', profile?.id)
        .single();

      setCliente(clienteData);
      if (!clienteData) { setLoading(false); return; }

      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*, ordens_servico(numero_os, id, data_programada, hora_inicio), prestadores:tecnico_responsavel_id(nome, email, telefone)')
        .eq('cliente_id', clienteData.id)
        .order('created_at', { ascending: false });

      setTickets(ticketsData || []);

      const total = ticketsData?.length || 0;
      const abertos = ticketsData?.filter(t => ['aberto', 'aprovado', 'ordem_servico_gerada'].includes(t.status)).length || 0;
      const emExecucao = ticketsData?.filter(t => t.status === 'em_execucao').length || 0;
      const concluidos = ticketsData?.filter(t => t.status === 'concluido').length || 0;
      setStats({ total, abertos, emExecucao, concluidos });

      const { data: equipamentosData } = await supabase
        .from('equipamentos')
        .select('*')
        .eq('cliente_id', clienteData.id)
        .order('created_at', { ascending: false });

      setEquipamentos(equipamentosData || []);

      if (ticketsData && ticketsData.length > 0) {
        const ticketIds = ticketsData.map(t => t.id);
        const { data: rmesData } = await supabase
          .from('rme_relatorios')
          .select('*, tickets(numero_ticket, titulo), ordens_servico(numero_os), tecnicos(id, profiles(nome))')
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: false })
          .limit(10);

        setRmes(rmesData || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  return { loading, cliente, tickets, equipamentos, rmes, stats };
};
