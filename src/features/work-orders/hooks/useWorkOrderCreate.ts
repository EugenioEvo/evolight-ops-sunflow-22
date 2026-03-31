import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { WorkOrderCreateData, WOClienteOption, WOTecnicoOption } from '../types';

export const useWorkOrderCreate = () => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<WOClienteOption[]>([]);
  const [tecnicos, setTecnicos] = useState<WOTecnicoOption[]>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const [ufvSolarzList, setUfvSolarzList] = useState<string[]>([]);
  const navigate = useNavigate();
  const { handleError } = useErrorHandler();

  useEffect(() => { loadClientes(); loadTecnicos(); }, []);

  const loadClientes = async () => {
    const { data } = await supabase.from('clientes').select('id, empresa, ufv_solarz').order('empresa');
    const items: WOClienteOption[] = (data || []).map(c => ({ id: c.id, empresa: c.empresa ?? '', ufv_solarz: c.ufv_solarz }));
    setClientes(items);
    const ufvList = items.map(c => c.ufv_solarz).filter((u): u is string => u !== null && u.trim() !== '').filter((u, i, a) => a.indexOf(u) === i).sort();
    setUfvSolarzList(ufvList);
  };

  const loadTecnicos = async () => {
    const { data } = await supabase.from('prestadores').select('id, nome').eq('categoria', 'tecnico').eq('ativo', true).order('nome');
    setTecnicos((data || []) as WOTecnicoOption[]);
  };

  const addTeamMember = () => {
    if (newMember.trim() && !teamMembers.includes(newMember.trim())) {
      setTeamMembers([...teamMembers, newMember.trim()]);
      setNewMember('');
    }
  };

  const removeTeamMember = (m: string) => setTeamMembers(teamMembers.filter(t => t !== m));
  const toggleWorkType = (v: string) => setSelectedWorkTypes(prev => prev.includes(v) ? prev.filter(t => t !== v) : [...prev, v]);

  const submitWorkOrder = async (data: WorkOrderCreateData) => {
    if (selectedWorkTypes.length === 0) {
      toast.error('Selecione pelo menos um tipo de trabalho');
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: clienteData } = await supabase.from('clientes').select('endereco, cidade, estado').eq('id', data.cliente_id).single();
      const endereco = clienteData ? `${clienteData.endereco || ''}, ${clienteData.cidade || ''} - ${clienteData.estado || ''}` : data.site_name;

      const { data: ticketData, error: ticketError } = await supabase.from('tickets').insert([{
        numero_ticket: '', cliente_id: data.cliente_id,
        titulo: `OS - ${data.site_name} - ${data.servico_solicitado}`,
        descricao: data.descricao, endereco_servico: endereco,
        equipamento_tipo: 'outros' as const,
        prioridade: data.servico_solicitado === 'emergencia' ? 'critica' as const : 'media' as const,
        status: 'ordem_servico_gerada' as const,
        created_by: userData.user?.id!,
        data_vencimento: data.data_programada.toISOString(),
      }]).select().single();
      if (ticketError) throw ticketError;

      const { data: osData, error: osError } = await supabase.from('ordens_servico').insert([{
        ticket_id: ticketData.id, numero_os: `OS${Date.now()}`,
        data_programada: data.data_programada.toISOString(),
        hora_inicio: data.hora_inicio || null, hora_fim: data.hora_fim || null,
        site_name: data.site_name, servico_solicitado: data.servico_solicitado,
        work_type: selectedWorkTypes,
        equipe: teamMembers.length > 0 ? teamMembers : null,
        inspetor_responsavel: data.inspetor_responsavel,
        notes: data.notes || null,
      }]).select().single();
      if (osError) throw osError;

      toast.success(`OS ${osData.numero_os} criada com sucesso!`);
      navigate(`/work-orders/${osData.id}`);
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao criar OS' });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading, clientes, tecnicos, selectedWorkTypes, teamMembers, newMember, setNewMember,
    ufvSolarzList, addTeamMember, removeTeamMember, toggleWorkType, submitWorkOrder, navigate,
  };
};
