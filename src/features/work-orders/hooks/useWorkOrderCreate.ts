import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { workOrderService as defaultService } from '../services/workOrderService';
import type { WorkOrderCreateData, WOClienteOption, WOTecnicoOption } from '../types';

export const useWorkOrderCreate = (service = defaultService) => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<WOClienteOption[]>([]);
  const [tecnicos, setTecnicos] = useState<WOTecnicoOption[]>([]);
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const [ufvSolarzList, setUfvSolarzList] = useState<string[]>([]);
  const navigate = useNavigate();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    service.loadClientesForCreate().then(items => {
      setClientes(items);
      const ufvList = items.map(c => c.ufv_solarz).filter((u): u is string => u !== null && u.trim() !== '').filter((u, i, a) => a.indexOf(u) === i).sort();
      setUfvSolarzList(ufvList);
    });
    service.loadTecnicosForCreate().then(setTecnicos);
  }, []);

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
      const osData = await service.submitWorkOrder({ ...data, selectedWorkTypes, teamMembers });
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
