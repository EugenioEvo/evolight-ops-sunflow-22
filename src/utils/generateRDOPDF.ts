import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CLIMA_LABEL, TURNO_LABEL, RDO_STATUS_LABEL, type RDOStatus } from '@/features/rdo/types';

export interface RDOPDFData {
  numero_rdo: string;
  data_rdo: string;
  status: RDOStatus | string;
  obra: { nome: string; cidade?: string | null; estado?: string | null } | null;
  responsavel: { nome: string } | null;
  turno?: string | null;
  clima?: string | null;
  temperatura_c?: number | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  condicoes_canteiro?: string | null;
  observacoes_gerais?: string | null;
  ocorrencias?: string | null;
  atrasos?: string | null;
  restricoes?: string | null;
  observacoes_aprovacao?: string | null;
  data_aprovacao?: string | null;
  equipe: Array<{ nome: string; funcao?: string | null; horas_trabalhadas?: number | null; horas_extras?: number | null }>;
  atividades: Array<{ descricao: string; quantidade: number; unidade?: string | null; percentual_avanco?: number | null }>;
  equipamentos: Array<{ nome: string; quantidade: number; observacoes?: string | null }>;
  evidencias: Array<{ tipo: string; url: string; descricao?: string | null }>;
  assinatura_responsavel?: string | null;
  assinatura_aprovador?: string | null;
}

const PRIMARY: [number, number, number] = [202, 138, 4]; // amber-600 (Evolight)
const TEXT: [number, number, number] = [20, 20, 20];
const MUTED: [number, number, number] = [110, 110, 110];

const fmtDateBR = (iso?: string | null) => {
  if (!iso) return '-';
  const part = iso.includes('T') ? iso.split('T')[0] : iso;
  const [y, m, d] = part.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const fetchAsDataURL = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const generateRDOPDF = async (data: RDOPDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  const ensureSpace = (need = 30) => {
    if (yPos + need > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  const sectionHeader = (label: string) => {
    ensureSpace(16);
    doc.setFillColor(...PRIMARY);
    doc.rect(margin, yPos - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + 3, yPos + 1.8);
    yPos += 10;
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'normal');
  };

  const kvRows = (rows: Array<[string, string]>, labelWidth = 45) => {
    doc.setFontSize(9);
    rows.forEach(([label, value]) => {
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT);
      doc.text(label, margin, yPos);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(value || '-'), contentWidth - labelWidth);
      doc.text(lines, margin + labelWidth, yPos);
      yPos += Math.max(6, lines.length * 5);
    });
  };

  const paragraph = (label: string, value?: string | null) => {
    if (!value) return;
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(label, margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, contentWidth);
    ensureSpace(lines.length * 5 + 4);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5 + 3;
  };

  // ===== HEADER BAND =====
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DIÁRIO DE OBRA (RDO)', pageWidth / 2, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${data.numero_rdo}  |  Data: ${fmtDateBR(data.data_rdo)}`, pageWidth / 2, 22, { align: 'center' });

  // status badge
  const statusKey = (data.status || 'rascunho').toLowerCase();
  const badgeColors: Record<string, [number, number, number]> = {
    rascunho: [148, 163, 184],
    pendente: [234, 179, 8],
    aprovado: [34, 197, 94],
    rejeitado: [239, 68, 68],
  };
  const badgeColor = badgeColors[statusKey] || badgeColors.rascunho;
  const badgeLabel = (RDO_STATUS_LABEL as any)[statusKey]?.toUpperCase() || statusKey.toUpperCase();
  doc.setFillColor(...badgeColor);
  const badgeW = 38;
  doc.roundedRect(pageWidth - margin - badgeW, 28, badgeW, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeLabel, pageWidth - margin - badgeW / 2, 33.5, { align: 'center' });

  yPos = 52;
  doc.setTextColor(...TEXT);

  // ===== 1. IDENTIFICAÇÃO =====
  sectionHeader('1. IDENTIFICAÇÃO');
  const obraStr = data.obra
    ? `${data.obra.nome}${data.obra.cidade ? ` — ${data.obra.cidade}/${data.obra.estado ?? ''}` : ''}`
    : '-';
  kvRows([
    ['Obra:', obraStr],
    ['Responsável:', data.responsavel?.nome ?? '-'],
    ['Turno:', data.turno ? (TURNO_LABEL as any)[data.turno] ?? data.turno : '-'],
    ['Clima:', data.clima ? (CLIMA_LABEL as any)[data.clima] ?? data.clima : '-'],
    ['Temperatura:', data.temperatura_c != null ? `${data.temperatura_c} °C` : '-'],
    ['Horário:', `${data.horario_inicio ?? '-'} às ${data.horario_fim ?? '-'}`],
  ]);
  paragraph('Condições do canteiro:', data.condicoes_canteiro);

  // ===== 2. EQUIPE =====
  sectionHeader('2. EQUIPE');
  if (data.equipe.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Nenhum membro registrado.', margin, yPos);
    yPos += 6;
    doc.setTextColor(...TEXT);
  } else {
    autoTable(doc, {
      startY: yPos,
      head: [['Nome', 'Função', 'Horas', 'H. Extras']],
      body: data.equipe.map((e) => [
        e.nome,
        e.funcao ?? '-',
        String(e.horas_trabalhadas ?? 0),
        String(e.horas_extras ?? 0),
      ]),
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== 3. ATIVIDADES =====
  sectionHeader('3. ATIVIDADES EXECUTADAS');
  if (data.atividades.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Nenhuma atividade registrada.', margin, yPos);
    yPos += 6;
    doc.setTextColor(...TEXT);
  } else {
    autoTable(doc, {
      startY: yPos,
      head: [['Descrição', 'Qtd.', 'Unid.', 'Avanço %']],
      body: data.atividades.map((a) => [
        a.descricao,
        String(a.quantidade ?? 0),
        a.unidade ?? '-',
        a.percentual_avanco != null ? `${a.percentual_avanco}%` : '-',
      ]),
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== 4. EQUIPAMENTOS =====
  if (data.equipamentos.length > 0) {
    sectionHeader('4. EQUIPAMENTOS');
    autoTable(doc, {
      startY: yPos,
      head: [['Equipamento', 'Qtd.', 'Observações']],
      body: data.equipamentos.map((e) => [e.nome, String(e.quantidade), e.observacoes ?? '-']),
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== 5. OCORRÊNCIAS =====
  if (data.ocorrencias || data.atrasos || data.restricoes || data.observacoes_gerais) {
    sectionHeader('5. OCORRÊNCIAS E OBSERVAÇÕES');
    paragraph('Ocorrências:', data.ocorrencias);
    paragraph('Atrasos:', data.atrasos);
    paragraph('Restrições:', data.restricoes);
    paragraph('Observações gerais:', data.observacoes_gerais);
  }

  // ===== 6. EVIDÊNCIAS =====
  if (data.evidencias.length > 0) {
    sectionHeader('6. EVIDÊNCIAS FOTOGRÁFICAS');
    const cellW = (contentWidth - 6) / 2;
    const cellH = 50;
    let col = 0;
    for (const ev of data.evidencias) {
      ensureSpace(cellH + 12);
      const dataUrl = await fetchAsDataURL(ev.url);
      const x = margin + col * (cellW + 6);
      try {
        if (dataUrl) {
          doc.addImage(dataUrl, 'JPEG', x, yPos, cellW, cellH);
        } else {
          doc.setDrawColor(...MUTED);
          doc.rect(x, yPos, cellW, cellH);
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text('(imagem indisponível)', x + 2, yPos + cellH / 2);
        }
      } catch {
        doc.setDrawColor(...MUTED);
        doc.rect(x, yPos, cellW, cellH);
      }
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      const cap = `[${ev.tipo}]${ev.descricao ? ` ${ev.descricao}` : ''}`;
      doc.text(doc.splitTextToSize(cap, cellW), x, yPos + cellH + 4);
      col++;
      if (col >= 2) {
        col = 0;
        yPos += cellH + 12;
      }
    }
    if (col > 0) yPos += cellH + 12;
  }

  // ===== 7. ASSINATURAS =====
  ensureSpace(60);
  sectionHeader('7. ASSINATURAS');
  const sigW = (contentWidth - 10) / 2;
  const sigH = 28;
  const drawSig = (x: number, label: string, dataUrl?: string | null, sub?: string) => {
    doc.setDrawColor(...MUTED);
    doc.rect(x, yPos, sigW, sigH);
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, 'PNG', x + 2, yPos + 2, sigW - 4, sigH - 4);
      } catch {}
    }
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(label, x, yPos + sigH + 5);
    if (sub) {
      doc.setTextColor(...MUTED);
      doc.text(sub, x, yPos + sigH + 10);
    }
  };
  drawSig(margin, 'Responsável (Sup. Eletromecânico)', data.assinatura_responsavel, data.responsavel?.nome);
  drawSig(
    margin + sigW + 10,
    'Aprovador (Engenharia / Supervisão)',
    data.assinatura_aprovador,
    data.data_aprovacao ? `Aprovado em ${fmtDateBR(data.data_aprovacao)}` : undefined,
  );
  yPos += sigH + 16;

  if (data.observacoes_aprovacao) {
    paragraph('Observações da aprovação:', data.observacoes_aprovacao);
  }

  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Evolight • RDO ${data.numero_rdo} • Página ${i}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  return doc.output('blob');
};

/** Trigger a download of an RDO PDF using the hidden anchor pattern. */
export const downloadRDOPDF = async (data: RDOPDFData) => {
  const blob = await generateRDOPDF(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RDO-${data.numero_rdo}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
