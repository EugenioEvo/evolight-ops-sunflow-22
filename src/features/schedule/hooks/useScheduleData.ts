import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { useGlobalRealtime } from "@/hooks/useRealtimeProvider";
import { useAgendaRealtime } from "@/hooks/useAgendaRealtime";
import { scheduleService } from "../services/scheduleService";
import type { AgendaOrdemServico, Tecnico } from "../types";

export function useScheduleData() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTecnico, setSelectedTecnico] = useState<string>('todos');
  const [ordensServico, setOrdensServico] = useState<AgendaOrdemServico[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleAsyncError } = useErrorHandler();

  const getDateKey = (value: string | Date | null | undefined) => {
    if (!value) return '';
    if (value instanceof Date) return format(value, 'yyyy-MM-dd');
    return value.slice(0, 10);
  };

  const loadOrdensServico = useCallback(async () => {
    setLoading(true);
    await handleAsyncError(
      async () => {
        const data = await scheduleService.loadOrdensServico(selectedDate, selectedTecnico);
        setOrdensServico(data as AgendaOrdemServico[]);
      },
      { fallbackMessage: 'Erro ao carregar agenda', showToast: false }
    );
    setLoading(false);
  }, [selectedDate, selectedTecnico]);

  useGlobalRealtime(loadOrdensServico);
  useAgendaRealtime({ onUpdate: loadOrdensServico, selectedDate });

  useEffect(() => {
    scheduleService.loadTecnicos().then(setTecnicos);
  }, []);

  useEffect(() => {
    loadOrdensServico();
  }, [loadOrdensServico]);

  const osDoDia = ordensServico.filter(os => getDateKey(os.data_programada) === getDateKey(selectedDate));

  const diasComOS = ordensServico.reduce((acc, os) => {
    const dateStr = getDateKey(os.data_programada);
    if (!dateStr) return acc;
    const [year, month, day] = dateStr.split('-').map(Number);
    const key = `${year}-${month - 1}-${day}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    selectedDate, setSelectedDate,
    selectedTecnico, setSelectedTecnico,
    ordensServico, tecnicos, loading,
    osDoDia, diasComOS, loadOrdensServico,
  };
}
