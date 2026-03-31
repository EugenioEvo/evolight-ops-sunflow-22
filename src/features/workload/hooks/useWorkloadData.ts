import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Tecnico { id: string; nome: string; }

export interface WorkloadData {
  data: string;
  total_os: number;
  total_minutos: number;
  os_pendentes: number;
  os_concluidas: number;
}

export interface TecnicoStats {
  totalOS: number;
  totalHoras: number;
  osPendentes: number;
  osConcluidas: number;
  disponibilidade: number;
  workloadByDay: WorkloadData[];
}

export const useWorkloadData = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState<string>('');
  const [stats, setStats] = useState<TecnicoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadTecnicos(); }, []);
  useEffect(() => { if (selectedTecnico) loadWorkloadData(); }, [selectedTecnico, selectedMonth]);

  const loadTecnicos = async () => {
    const { data } = await supabase.from('tecnicos').select('id, profiles!inner(nome)').order('profiles(nome)');
    if (data) {
      const formatted = data.map(t => ({ id: t.id, nome: (t.profiles as any).nome }));
      setTecnicos(formatted);
      if (formatted.length > 0) setSelectedTecnico(formatted[0].id);
    }
  };

  const loadWorkloadData = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      const { data: workloadData, error } = await supabase.rpc('get_technician_workload', {
        p_tecnico_id: selectedTecnico,
        p_start_date: format(start, 'yyyy-MM-dd'),
        p_end_date: format(end, 'yyyy-MM-dd'),
      });
      if (error) throw error;

      if (workloadData && workloadData.length > 0) {
        const totalOS = workloadData.reduce((s: number, d: WorkloadData) => s + d.total_os, 0);
        const totalMinutos = workloadData.reduce((s: number, d: WorkloadData) => s + d.total_minutos, 0);
        const osPendentes = workloadData.reduce((s: number, d: WorkloadData) => s + d.os_pendentes, 0);
        const osConcluidas = workloadData.reduce((s: number, d: WorkloadData) => s + d.os_concluidas, 0);
        const horasDisponiveis = 22 * 8 * 60;
        const disponibilidade = Math.max(0, Math.min(100, (totalMinutos / horasDisponiveis) * 100));
        setStats({
          totalOS, totalHoras: Math.round(totalMinutos / 60 * 10) / 10,
          osPendentes, osConcluidas, disponibilidade: Math.round(disponibilidade),
          workloadByDay: workloadData,
        });
      } else {
        setStats({ totalOS: 0, totalHoras: 0, osPendentes: 0, osConcluidas: 0, disponibilidade: 0, workloadByDay: [] });
      }
    } catch (error) {
      console.error('Erro ao carregar carga de trabalho:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDisponibilidadeColor = (d: number) => d < 50 ? 'text-green-600' : d < 80 ? 'text-yellow-600' : 'text-red-600';
  const getDisponibilidadeStatus = (d: number) => d < 50 ? 'Disponível' : d < 80 ? 'Moderado' : 'Sobrecarregado';

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
      doc.setFontSize(24);
      doc.text('SunFlow', 15, 20);
      doc.setFontSize(12);
      doc.text('Relatório de Carga de Trabalho', 15, 30);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.text(`Técnico: ${tecnico?.nome || 'N/A'}`, 15, 55);
      doc.setFontSize(12);
      doc.text(`Período: ${mesNome}`, 15, 63);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 15, 70);

      let yPos = 85;
      doc.setFillColor(249, 250, 251);
      doc.rect(15, yPos, 180, 50, 'F');
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Resumo do Mês', 20, yPos + 10);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      [`Total de OS: ${stats.totalOS}`, `Total de Horas: ${stats.totalHoras}h`, `OS Pendentes: ${stats.osPendentes}`, `OS Concluídas: ${stats.osConcluidas}`].forEach((m, i) => {
        doc.text(m, 25, yPos + 22 + i * 7);
      });

      yPos += 55;
      doc.setFillColor(239, 246, 255);
      doc.rect(15, yPos, 180, 30, 'F');
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Disponibilidade', 20, yPos + 10);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      const statusCor = stats.disponibilidade < 50 ? [34, 197, 94] : stats.disponibilidade < 80 ? [234, 179, 8] : [239, 68, 68];
      doc.setTextColor(statusCor[0], statusCor[1], statusCor[2]);
      doc.text(`${stats.disponibilidade}% - ${getDisponibilidadeStatus(stats.disponibilidade)}`, 25, yPos + 20);
      doc.setTextColor(0, 0, 0);
      doc.text(`Ocupado: ${stats.totalHoras}h | Disponível: ${Math.max(0, 176 - stats.totalHoras)}h`, 25, yPos + 27);
      yPos += 40;

      if (stats.workloadByDay.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Distribuição Diária', 15, yPos);
        yPos += 10;
        const tableData = stats.workloadByDay.map(day => [
          format(new Date(day.data), "dd/MM (EEE)", { locale: ptBR }),
          day.total_os.toString(), `${Math.round(day.total_minutos / 60 * 10) / 10}h`,
          day.os_pendentes.toString(), day.os_concluidas.toString(),
        ]);
        (doc as any).autoTable({
          startY: yPos, head: [['Data', 'OS', 'Horas', 'Pendentes', 'Concluídas']], body: tableData,
          theme: 'grid', headStyles: { fillColor: [245, 158, 11], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 30, halign: 'center' }, 4: { cellWidth: 30, halign: 'center' } },
        });
      }

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      }

      doc.save(`carga_trabalho_${tecnico?.nome.replace(/\s+/g, '_')}_${format(selectedMonth, 'yyyy_MM')}.pdf`);
      toast({ title: 'PDF exportado', description: 'Relatório salvo com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return {
    selectedMonth, setSelectedMonth, tecnicos, selectedTecnico, setSelectedTecnico,
    stats, loading, exporting, exportToPDF,
    getDisponibilidadeColor, getDisponibilidadeStatus,
  };
};
