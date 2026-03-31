import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { OrdemServicoPresenca } from '../types';

export const usePresenceExport = (
  ordensServicoFiltradas: OrdemServicoPresenca[],
  statsFiltradas: { total: number; confirmadas: number; pendentes: number },
  setExporting: (v: boolean) => void,
) => {
  const groupByTecnico = () => {
    return ordensServicoFiltradas.reduce((acc, os) => {
      const nome = os.tecnicos?.profiles?.nome || 'Não atribuído';
      if (!acc[nome]) acc[nome] = [];
      acc[nome].push(os);
      return acc;
    }, {} as Record<string, OrdemServicoPresenca[]>);
  };

  const exportarPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const dataAtual = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

      doc.setFontSize(18);
      doc.text('Relatório de Confirmações de Presença', 14, 20);
      doc.setFontSize(12);
      doc.text(`Data: ${dataAtual}`, 14, 30);
      doc.setFontSize(10);
      doc.text(`Total de OS: ${statsFiltradas.total}`, 14, 40);
      doc.text(`Confirmadas: ${statsFiltradas.confirmadas}`, 14, 46);
      doc.text(`Pendentes: ${statsFiltradas.pendentes}`, 14, 52);

      const osPorTecnico = groupByTecnico();
      let yPosition = 60;

      Object.entries(osPorTecnico).forEach(([tecnico, osArray]) => {
        if (yPosition > 250) { doc.addPage(); yPosition = 20; }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(tecnico, 14, yPosition);
        yPosition += 6;

        const confirmadas = osArray.filter(os => os.presence_confirmed_at).length;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total: ${osArray.length} | Confirmadas: ${confirmadas} | Pendentes: ${osArray.length - confirmadas}`, 14, yPosition);
        yPosition += 8;

        const tableData = osArray.map(os => [
          os.numero_os,
          os.hora_inicio ? `${os.hora_inicio.slice(0, 5)} - ${os.hora_fim?.slice(0, 5) || ''}` : '-',
          os.tickets?.titulo || '-',
          os.presence_confirmed_at
            ? `✓ ${format(new Date(os.presence_confirmed_at), 'HH:mm', { locale: ptBR })}`
            : 'Pendente'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['OS', 'Horário', 'Descrição', 'Confirmação']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 35 }, 2: { cellWidth: 80 }, 3: { cellWidth: 40 } },
          margin: { left: 14 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      });

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${totalPages}`,
          14, doc.internal.pageSize.height - 10
        );
      }

      doc.save(`confirmacoes_presenca_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const exportarExcel = () => {
    setExporting(true);
    try {
      const osPorTecnico = groupByTecnico();
      const workbook = XLSX.utils.book_new();

      const resumoData: any[][] = [
        ['RELATÓRIO DE CONFIRMAÇÕES DE PRESENÇA'],
        [`Data: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`],
        [],
        ['ESTATÍSTICAS GERAIS'],
        ['Total de OS', statsFiltradas.total],
        ['Confirmadas', statsFiltradas.confirmadas],
        ['Pendentes', statsFiltradas.pendentes],
        ['Percentual de Confirmação', `${statsFiltradas.total > 0 ? Math.round((statsFiltradas.confirmadas / statsFiltradas.total) * 100) : 0}%`],
        [],
        ['RESUMO POR TÉCNICO'],
        ['Técnico', 'Total OS', 'Confirmadas', 'Pendentes', '% Confirmação']
      ];

      Object.entries(osPorTecnico).forEach(([tecnico, osArray]) => {
        const confirmadas = osArray.filter(os => os.presence_confirmed_at).length;
        resumoData.push([tecnico, osArray.length, confirmadas, osArray.length - confirmadas, `${Math.round((confirmadas / osArray.length) * 100)}%`]);
      });

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(resumoData), 'Resumo');

      const detalhesData: any[][] = [
        ['Técnico', 'OS', 'Horário', 'Cliente', 'Descrição', 'Endereço', 'Status', 'Hora Confirmação']
      ];

      Object.entries(osPorTecnico).forEach(([tecnico, osArray]) => {
        osArray.forEach(os => {
          detalhesData.push([
            tecnico, os.numero_os,
            os.hora_inicio ? `${os.hora_inicio.slice(0, 5)} - ${os.hora_fim?.slice(0, 5) || ''}` : '-',
            os.tickets?.clientes?.empresa || '-',
            os.tickets?.titulo || '-',
            os.tickets?.endereco_servico || '-',
            os.presence_confirmed_at ? 'Confirmada' : 'Pendente',
            os.presence_confirmed_at ? format(new Date(os.presence_confirmed_at), 'HH:mm', { locale: ptBR }) : '-'
          ]);
        });
      });

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(detalhesData), 'Detalhes');
      XLSX.writeFile(workbook, `confirmacoes_presenca_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    } finally {
      setExporting(false);
    }
  };

  return { exportarPDF, exportarExcel };
};
