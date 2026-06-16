import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { useGlobalRealtime } from "@/hooks/useRealtimeProvider";
import { useAgendaRealtime } from "@/hooks/useAgendaRealtime";
import { computeScheduleEnd } from "@/utils/scheduleWindow";
import { scheduleService } from "../services/scheduleService";
import type { AgendaOrdemServico, Tecnico } from "../types";

export function useScheduleData() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTecnico, setSelectedTecnico] = useState<string>('todos');
  const [selectedAceite, setSelectedAceite] = useState<string>('todos');
  const [ordensServico, setOrdensServico] = useState<AgendaOrdemServico[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleAsyncError } = useErrorHandler();

  const getDateKey = (value: string | Date | null | undefined) => {
    if (!value) return '';
    if (value instanceof Date) return format(value, 'yyyy-MM-dd');
    return value.slice(0, 10);
  };

  // Parse "YYYY-MM-DD" into a local Date at midnight (no TZ shift)
  const dateOnlyToLocal = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  // Parse "HH:MM[:SS]" -> minutes
  const parseTimeToMin = (t?: string | null) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Returns [startDayKey, endDayKey] (yyyy-mm-dd) covering all days the OS spans.
  const getOSDayRange = (os: AgendaOrdemServico): { startKey: string; endKey: string } | null => {
    const startKey = getDateKey(os.data_programada);
    if (!startKey) return null;
    const startBase = dateOnlyToLocal(startKey);
    const startMin = parseTimeToMin(os.hora_inicio);
    let durationMin = os.duracao_estimada_min || 0;
    if (!durationMin && os.hora_fim) {
      const endMin = parseTimeToMin(os.hora_fim);
      durationMin = Math.max(0, endMin - startMin);
    }
    const startDate = new Date(startBase);
    startDate.setMinutes(startDate.getMinutes() + startMin);

    if (durationMin > 0) {
      const window = computeScheduleEnd(startKey, os.hora_inicio || '08:00', durationMin);
      return {
        startKey,
        endKey: window.endDate,
      };
    }

    return {
      startKey: format(startDate, 'yyyy-MM-dd'),
      endKey: startKey,
    };
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

  const selectedKey = getDateKey(selectedDate);

  const osDoDia = ordensServico
    .filter(os => {
      const range = getOSDayRange(os);
      if (!range) return false;
      return selectedKey >= range.startKey && selectedKey <= range.endKey;
    })
    .filter(os => selectedAceite === 'todos' || os.aceite_tecnico === selectedAceite);

  const diasComOS = ordensServico.reduce((acc, os) => {
    const range = getOSDayRange(os);
    if (!range) return acc;
    const start = dateOnlyToLocal(range.startKey);
    const end = dateOnlyToLocal(range.endKey);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return {
    selectedDate, setSelectedDate,
    selectedTecnico, setSelectedTecnico,
    selectedAceite, setSelectedAceite,
    ordensServico, tecnicos, loading,
    osDoDia, diasComOS, loadOrdensServico,
  };
}
