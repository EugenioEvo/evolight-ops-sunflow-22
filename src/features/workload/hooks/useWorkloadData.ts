import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useGlobalRealtime } from '@/hooks/useRealtimeProvider';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface WorkloadTecnico { id: string; nome: string; }

export interface WorkloadData {
  data: string;
  total_os: number;
  total_minutos_previstos: number;
  total_minutos_realizados: number;
  os_pendentes: number;
  os_concluidas: number;
}

export interface OSDetailRow {
  ordem_servico_id: string;
  numero_os: string;
  data_programada: string | null;
  cliente: string;
  ticket_titulo: string;
  minutos_previstos: number;
  minutos_realizados: number;
  ticket_status: string;
}

export interface TecnicoStats {
  totalOS: number;
  totalMinutosPrevistos: number;
  totalMinutosRealizados: number;
  totalHorasPrevistas: number;   // horas (1 casa)
  totalHorasRealizadas: number;  // horas (1 casa)
  aderencia: number;             // % realizado/previsto
  variacaoMinutos: number;       // realizado - previsto (positivo = estouro)
  osPendentes: number;
  osConcluidas: number;
  workloadByDay: WorkloadData[];
  topEstouros: Array<OSDetailRow & { estouroMin: number; aderenciaOS: number }>;
}

/** Service port — DI for tests */
export interface WorkloadServicePort {
  loadTecnicos(): Promise<WorkloadTecnico[]>;
  loadWorkload(tecnicoId: string, startDate: string, endDate: string): Promise<WorkloadData[]>;
  loadDetail(tecnicoId: string, startDate: string, endDate: string): Promise<OSDetailRow[]>;
}

const defaultWorkloadService: WorkloadServicePort = {
  /** Only technicians with assigned OS appear (mirrors Agenda filter behavior). */
  async loadTecnicos() {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('tecnico_id, tecnicos!inner(id, profiles!inner(nome))')
      .not('tecnico_id', 'is', null);
    if (error) throw error;
    const seen = new Map<string, string>();
    (data || []).forEach((row: any) => {
      const id = row.tecnicos?.id;
      const nome = row.tecnicos?.profiles?.nome;
      if (id && nome && !seen.has(id)) seen.set(id, nome);
    });
    return Array.from(seen.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },
  async loadWorkload(tecnicoId, startDate, endDate) {
    const { data, error } = await supabase.rpc('get_technician_workload', {
      p_tecnico_id: tecnicoId, p_start_date: startDate, p_end_date: endDate,
    });
    if (error) throw error;
    return (data || []) as WorkloadData[];
  },
  async loadDetail(tecnicoId, startDate, endDate) {
    const { data, error } = await supabase.rpc('get_technician_workload_os_detail', {
      p_tecnico_id: tecnicoId, p_start_date: startDate, p_end_date: endDate,
    });
    if (error) throw error;
    return (data || []) as OSDetailRow[];
  },
};

export const useWorkloadData = (service: WorkloadServicePort = defaultWorkloadService) => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [tecnicos, setTecnicos] = useState<WorkloadTecnico[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState<string>('');
  const [stats, setStats] = useState<TecnicoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { handleError } = useErrorHandler();

  useEffect(() => {
    service.loadTecnicos()
      .then(formatted => {
        setTecnicos(formatted);
        if (formatted.length > 0) setSelectedTecnico(formatted[0].id);
      })
      .catch(err => handleError(err, { fallbackMessage: 'Erro ao carregar técnicos' }));
  }, []);

  useEffect(() => { if (selectedTecnico) loadWorkloadData(); }, [selectedTecnico, selectedMonth]);

  // Realtime: refresh workload when OS / RME / tickets change
  useGlobalRealtime(() => { if (selectedTecnico) loadWorkloadData(); });

  const loadWorkloadData = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      const [workloadData, detail] = await Promise.all([
        service.loadWorkload(selectedTecnico, startStr, endStr),
        service.loadDetail(selectedTecnico, startStr, endStr),
      ]);

      const totalOS       = workloadData.reduce((s, d) => s + d.total_os, 0);
      const minPrevistos  = workloadData.reduce((s, d) => s + d.total_minutos_previstos, 0);
      const minRealizados = workloadData.reduce((s, d) => s + d.total_minutos_realizados, 0);
      const osPendentes   = workloadData.reduce((s, d) => s + d.os_pendentes, 0);
      const osConcluidas  = workloadData.reduce((s, d) => s + d.os_concluidas, 0);
      const aderencia     = minPrevistos > 0
        ? Math.round((minRealizados / minPrevistos) * 100)
        : 0;
      const variacao      = minRealizados - minPrevistos;

      const topEstouros = detail
        .filter(d => d.minutos_realizados > 0 || d.minutos_previstos > 0)
        .map(d => {
          const estouroMin = d.minutos_realizados - d.minutos_previstos;
          const aderenciaOS = d.minutos_previstos > 0
            ? Math.round((d.minutos_realizados / d.minutos_previstos) * 100)
            : 0;
          return { ...d, estouroMin, aderenciaOS };
        })
        .sort((a, b) => b.estouroMin - a.estouroMin)
        .slice(0, 5);

      setStats({
        totalOS,
        totalMinutosPrevistos: minPrevistos,
        totalMinutosRealizados: minRealizados,
        totalHorasPrevistas: Math.round(minPrevistos / 60 * 10) / 10,
        totalHorasRealizadas: Math.round(minRealizados / 60 * 10) / 10,
        aderencia,
        variacaoMinutos: variacao,
        osPendentes,
        osConcluidas,
        workloadByDay: workloadData,
        topEstouros,
      });
    } catch (error) {
      handleError(error, { fallbackMessage: 'Erro ao carregar carga de trabalho' });
    } finally {
      setLoading(false);
    }
  };

  // 8h * 22 dias = 176h baseline
  const horasDisponiveisMes = 176;

  const ocupacaoPercent = useMemo(() => {
    if (!stats) return 0;
    return Math.min(100, Math.round((stats.totalHorasPrevistas / horasDisponiveisMes) * 100));
  }, [stats]);

  const getOcupacaoColor = (p: number) => p < 50 ? 'text-green-600' : p < 80 ? 'text-yellow-600' : 'text-red-600';
  const getOcupacaoStatus = (p: number) => p < 50 ? 'Disponível' : p < 80 ? 'Moderado' : 'Sobrecarregado';

  const getAderenciaColor = (a: number) => {
    if (a === 0) return 'text-muted-foreground';
    if (a >= 90 && a <= 110) return 'text-green-600';
    if (a >= 75 && a < 90)   return 'text-yellow-600';
    return 'text-red-600';
  };
  const getAderenciaStatus = (a: number) => {
    if (a === 0) return 'Sem dados';
    if (a >= 90 && a <= 110) return 'No alvo';
    if (a < 90)              return 'Abaixo da meta';
    return 'Acima da meta';
  };

  const exportToPDF = async () => {
    if (!stats || !selectedTecnico) return;
    setExporting(true);
    try {
      const tecnico = tecnicos.find(t => t.id === selectedTecnico);
      const mesNome = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
      const doc = new jsPDF();

      doc.setFillColor(245, 158, 11);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24); doc.text('SunFlow', 15, 20);
      doc.setFontSize(12); doc.text('BI — Carga de Trabalho (Meta × Realizado)', 15, 30);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16); doc.text(`Técnico: ${tecnico?.nome || 'N/A'}`, 15, 55);
      doc.setFontSize(12);
      doc.text(`Período: ${mesNome}`, 15, 63);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 15, 70);

      let yPos = 85;
      doc.setFillColor(249, 250, 251);
      doc.rect(15, yPos, 180, 60, 'F');
      doc.setFontSize(14); doc.setFont(undefined, 'bold');
      doc.text('Resumo do Mês', 20, yPos + 10);
      doc.setFont(undefined, 'normal'); doc.setFontSize(11);
      [
        `Total de OS: ${stats.totalOS}`,
        `Horas Previstas (Meta): ${stats.totalHorasPrevistas}h`,
        `Horas Realizadas: ${stats.totalHorasRealizadas}h`,
        `Aderência: ${stats.aderencia}% — ${getAderenciaStatus(stats.aderencia)}`,
        `Variação: ${stats.variacaoMinutos >= 0 ? '+' : ''}${Math.round(stats.variacaoMinutos / 60 * 10) / 10}h`,
        `OS Pendentes: ${stats.osPendentes} | OS Concluídas: ${stats.osConcluidas}`,
      ].forEach((m, i) => doc.text(m, 25, yPos + 22 + i * 6));

      yPos += 70;

      if (stats.workloadByDay.length > 0) {
        doc.setFontSize(14); doc.setFont(undefined, 'bold');
        doc.text('Distribuição Diária — Meta × Realizado', 15, yPos);
        yPos += 6;
        const tableData = stats.workloadByDay.map(day => [
          format(new Date(day.data), "dd/MM (EEE)", { locale: ptBR }),
          day.total_os.toString(),
          `${Math.round(day.total_minutos_previstos / 60 * 10) / 10}h`,
          `${Math.round(day.total_minutos_realizados / 60 * 10) / 10}h`,
          day.os_pendentes.toString(),
          day.os_concluidas.toString(),
        ]);
        (doc as unknown as Record<string, Function>).autoTable({
          startY: yPos,
          head: [['Data', 'OS', 'Meta (h)', 'Realizado (h)', 'Pendentes', 'Concluídas']],
          body: tableData, theme: 'grid',
          headStyles: { fillColor: [245, 158, 11], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 3 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      if (stats.topEstouros.length > 0) {
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14); doc.setFont(undefined, 'bold');
        doc.text('Top 5 — Maiores Estouros de Meta', 15, yPos);
        yPos += 6;
        const tableData = stats.topEstouros.map(e => [
          e.numero_os,
          (e.cliente || '—').slice(0, 22),
          `${Math.round(e.minutos_previstos / 60 * 10) / 10}h`,
          `${Math.round(e.minutos_realizados / 60 * 10) / 10}h`,
          `${e.estouroMin >= 0 ? '+' : ''}${Math.round(e.estouroMin / 60 * 10) / 10}h`,
          `${e.aderenciaOS}%`,
        ]);
        (doc as unknown as Record<string, Function>).autoTable({
          startY: yPos,
          head: [['OS', 'Cliente', 'Meta', 'Realizado', 'Variação', 'Aderência']],
          body: tableData, theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 3 },
        });
      }

      const pageCount = (doc as unknown as Record<string, Record<string, Function>>).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9); doc.setTextColor(128, 128, 128);
        doc.text(`Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' });
      }

      doc.save(`carga_trabalho_${tecnico?.nome.replace(/\s+/g, '_')}_${format(selectedMonth, 'yyyy_MM')}.pdf`);
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      handleError(error, { fallbackMessage: 'Não foi possível gerar o PDF' });
    } finally {
      setExporting(false);
    }
  };

  return {
    selectedMonth, setSelectedMonth,
    tecnicos, selectedTecnico, setSelectedTecnico,
    stats, loading, exporting, exportToPDF,
    horasDisponiveisMes, ocupacaoPercent,
    getOcupacaoColor, getOcupacaoStatus,
    getAderenciaColor, getAderenciaStatus,
  };
};
