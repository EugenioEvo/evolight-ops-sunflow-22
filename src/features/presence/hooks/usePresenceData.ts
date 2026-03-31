import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { presenceService } from '../services/presenceService';
import type { OrdemServicoPresenca, PresenceTecnico } from '../types';

const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
  setTimeout(() => {
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.value = 1000;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    osc2.start(audioContext.currentTime);
    osc2.stop(audioContext.currentTime + 0.3);
  }, 150);
};

export const usePresenceData = () => {
  const [ordensServico, setOrdensServico] = useState<OrdemServicoPresenca[]>([]);
  const [tecnicos, setTecnicos] = useState<PresenceTecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filtroTecnico, setFiltroTecnico] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroHorario, setFiltroHorario] = useState('todos');
  const previousOSRef = useRef<Map<string, boolean>>(new Map());

  const loadOrdensServico = async () => {
    try {
      const data = await presenceService.fetchOrdensServico();
      const currentOSMap = new Map(data.map(os => [os.id, !!os.presence_confirmed_at]));

      data.forEach(os => {
        const wasConfirmed = previousOSRef.current.get(os.id);
        const isConfirmed = !!os.presence_confirmed_at;
        if (wasConfirmed === false && isConfirmed) {
          playNotificationSound();
          toast.success(
            `Presença confirmada: ${os.tecnicos?.profiles?.nome || 'Técnico'} - ${os.numero_os}`,
            { description: `Confirmado às ${format(new Date(os.presence_confirmed_at!), 'HH:mm', { locale: ptBR })}` }
          );
        }
      });

      previousOSRef.current = currentOSMap;
      setOrdensServico(data);
    } catch (error) {
      console.error('Erro ao carregar ordens de serviço:', error);
      toast.error('Erro ao carregar ordens de serviço');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    presenceService.fetchTecnicos().then(setTecnicos).catch(console.error);
    loadOrdensServico();

    const channel = supabase
      .channel('presenca-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => loadOrdensServico())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const ordensServicoFiltradas = useMemo(() => {
    let filtradas = [...ordensServico];
    if (filtroTecnico !== 'todos') filtradas = filtradas.filter(os => os.tecnico_id === filtroTecnico);
    if (filtroStatus === 'confirmada') filtradas = filtradas.filter(os => os.presence_confirmed_at !== null);
    else if (filtroStatus === 'pendente') filtradas = filtradas.filter(os => os.presence_confirmed_at === null);
    if (filtroHorario !== 'todos') {
      filtradas = filtradas.filter(os => {
        if (!os.hora_inicio) return false;
        const hora = parseInt(os.hora_inicio.split(':')[0]);
        if (filtroHorario === 'manha') return hora >= 6 && hora < 12;
        if (filtroHorario === 'tarde') return hora >= 12 && hora < 18;
        if (filtroHorario === 'noite') return hora >= 18 || hora < 6;
        return true;
      });
    }
    return filtradas;
  }, [ordensServico, filtroTecnico, filtroStatus, filtroHorario]);

  const statsFiltradas = useMemo(() => {
    const total = ordensServicoFiltradas.length;
    const confirmadas = ordensServicoFiltradas.filter(os => os.presence_confirmed_at).length;
    return { total, confirmadas, pendentes: total - confirmadas };
  }, [ordensServicoFiltradas]);

  const temFiltrosAtivos = filtroTecnico !== 'todos' || filtroStatus !== 'todos' || filtroHorario !== 'todos';

  const limparFiltros = () => {
    setFiltroTecnico('todos');
    setFiltroStatus('todos');
    setFiltroHorario('todos');
  };

  return {
    ordensServico, ordensServicoFiltradas, tecnicos, loading, exporting, setExporting,
    filtroTecnico, setFiltroTecnico, filtroStatus, setFiltroStatus,
    filtroHorario, setFiltroHorario, statsFiltradas, temFiltrosAtivos, limparFiltros,
  };
};
