import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Data shape for the RME PDF. Sections mirror the 6 wizard steps in order:
 *  1. Identificação
 *  2. Serviço e Execução
 *  3. Checklists Operacionais
 *  4. Evidências
 *  5. Ferramentas, EPIs e Medidas Preventivas
 *  6. Notas e Assinaturas
 */
export interface RMEPDFData {
  // Header / identification
  numero_os: string;
  cliente: string;
  endereco: string;
  site_name: string;
  ufv_solarz?: string;
  micro_number?: string;
  inverter_number?: string;
  tecnico_nome: string;
  collaboration: string[];

  // Service & shift
  data_execucao: string;
  data_fim_execucao?: string;
  weekday: string;
  shift: string;
  start_time: string;
  end_time: string;
  service_type: string[];

  // Checklists (filled from rme_checklist_items)
  checklists: {
    category: string;
    items: { label: string; checked: boolean }[];
  }[];

  // Evidence quantitatives + photos
  images_posted: boolean;
  modules_cleaned_qty: number;
  string_box_qty: number;
  fotos_antes_count: number;
  fotos_depois_count: number;
  /** Image URLs (signed) for "before" pictures — embedded as image previews. */
  fotos_antes_urls?: string[];
  /** Image URLs (signed) for "after" pictures — embedded as image previews. */
  fotos_depois_urls?: string[];

  // Final notes & materials
  materiais_utilizados: Array<{
    descricao: string;
    quantidade: number;
    tinha_estoque: boolean;
  }>;
  servicos_executados: string;
  condicoes_encontradas: string;

  // Signatures
  /** PNG DataURL of the on-screen technician signature. */
  assinatura_tecnico?: string;
  /** PNG DataURL of the on-screen client signature. */
  assinatura_cliente?: string;
  /** Printed name of the client signing on-screen. */
  nome_cliente_assinatura?: string;
  /**
   * Kept for backward compatibility with the older wizard model.
   * Only `responsavel` (Responsável Técnico) is rendered now — the wizard
   * no longer captures gerente_manutencao / gerente_projeto.
   */
  signatures: {
    responsavel?: { nome: string; at: string };
    gerente_manutencao?: { nome: string; at: string };
    gerente_projeto?: { nome: string; at: string };
  };

  // Approval status badge
  status_aprovacao: string;
}

// === Wizard-aligned label maps =====================================
// Step 2 — Tipo de Serviço (mirrors StepServiceShift.serviceTypes)
const serviceTypeLabels: Record<string, string> = {
  limpeza: 'Limpeza',
  eletrica: 'Elétrica',
  internet: 'Internet',
  outros: 'Outros',
};

// Step 2 — Turno (mirrors RMEWizard shifts)
const shiftLabels: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

// Steps 3 & 5 — categorias (mirrors StepChecklists + StepToolsEPIs)
const categoryLabels: Record<string, string> = {
  conexoes: 'Conexões',
  eletrica: 'Elétrica',
  internet: 'Internet',
  imagens: 'Imagens',
  ferramentas: 'Ferramentas',
  epis: 'EPIs (Equipamentos de Proteção)',
  medidas_preventivas: 'Medidas Preventivas',
};

const CHECKLIST_CATEGORIES = ['conexoes', 'eletrica', 'internet'];
const TOOLS_CATEGORIES = ['ferramentas', 'epis', 'medidas_preventivas'];

// === Theme tokens (kept consistent with previous PDF) ==============
const PRIMARY: [number, number, number] = [63, 81, 181];
const TEXT: [number, number, number] = [0, 0, 0];
const MUTED: [number, number, number] = [110, 110, 110];

const fmtDateBR = (iso?: string) => {
  if (!iso) return '-';
  // Accept "YYYY-MM-DD" or full ISO
  const datePart = iso.includes('T') ? iso.split('T')[0] : iso;
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

export const generateRMEPDF = async (data: RMEPDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  /** Ensure space before drawing a block; otherwise add a fresh page. */
  const checkNewPage = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  /** Draw a coloured section header bar — used to start each wizard step. */
  const sectionHeader = (label: string) => {
    checkNewPage(16);
    doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.rect(margin, yPos - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + 3, yPos + 1.8);
    yPos += 10;
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.setFont('helvetica', 'normal');
  };

  /** Render a label/value list with bold labels and wrapped values. */
  const drawKeyValueRows = (rows: Array<[string, string]>, labelWidth = 45) => {
    doc.setFontSize(9);
    rows.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text(label, margin, yPos);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(value || '-'), contentWidth - labelWidth);
      doc.text(lines, margin + labelWidth, yPos);
      yPos += Math.max(6, lines.length * 5);
    });
  };

  // ============ HEADER (cover band) =================================
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE MANUTENÇÃO EXECUTADA (RME)', pageWidth / 2, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS: ${data.numero_os || '-'}`, pageWidth / 2, 22, { align: 'center' });

  // Approval status badge — moved down to avoid clashing with title
  const statusRaw = (data.status_aprovacao || 'pendente').toLowerCase();
  const statusColor: [number, number, number] =
    statusRaw === 'aprovado' ? [34, 197, 94] :
    statusRaw === 'rejeitado' ? [239, 68, 68] :
    statusRaw === 'rascunho' ? [148, 163, 184] :
    [234, 179, 8];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(pageWidth - 50, 28, 40, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(statusRaw.toUpperCase(), pageWidth - 30, 33, { align: 'center' });

  yPos = 50;
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

  // ============ STEP 1 — IDENTIFICAÇÃO ==============================
  sectionHeader('1. IDENTIFICAÇÃO');
  const idRows: Array<[string, string]> = [
    ['Cliente:', data.cliente],
  ];
  if (data.ufv_solarz) idRows.push(['UFV/SolarZ:', data.ufv_solarz]);
  idRows.push(
    ['Endereço:', data.endereco],
    ['Usina:', data.site_name || '-'],
    ['Número Micro:', data.micro_number || '-'],
    ['Número Inversor:', data.inverter_number || '-'],
    ['Técnico Responsável:', data.tecnico_nome],
    ['Colaboradores:', (data.collaboration || []).length ? data.collaboration.join(', ') : '-'],
  );
  drawKeyValueRows(idRows);
  yPos += 4;

  // ============ STEP 2 — SERVIÇO E EXECUÇÃO =========================
  sectionHeader('2. SERVIÇO E EXECUÇÃO');

  const serviceTypesText = (data.service_type || [])
    .map((t) => serviceTypeLabels[t] || t)
    .join(', ') || '-';

  drawKeyValueRows([
    ['Tipo de Serviço:', serviceTypesText],
    ['Início (Data):', fmtDateBR(data.data_execucao)],
    ['Hora Início:', data.start_time || '-'],
    ['Fim (Data):', fmtDateBR(data.data_fim_execucao || data.data_execucao)],
    ['Hora Fim:', data.end_time || '-'],
    ['Dia da Semana:', data.weekday || '-'],
    ['Turno:', shiftLabels[data.shift] || data.shift || '-'],
  ]);
  yPos += 4;

  // ============ STEP 3 — CHECKLISTS OPERACIONAIS ====================
  sectionHeader('3. CHECKLISTS OPERACIONAIS');
  const operationalChecklists = (data.checklists || []).filter(c =>
    CHECKLIST_CATEGORIES.includes(c.category) && c.items.length > 0
  );

  if (operationalChecklists.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Nenhum item de checklist operacional registrado.', margin, yPos);
    yPos += 8;
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  } else {
    operationalChecklists.forEach((checklist) => {
      checkNewPage(28);
      const checkedCount = checklist.items.filter(i => i.checked).length;
      const totalCount = checklist.items.length;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text(
        `${categoryLabels[checklist.category] || checklist.category} (${checkedCount}/${totalCount})`,
        margin,
        yPos
      );
      yPos += 2;

      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Status']],
        body: checklist.items.map(item => [
          item.label,
          item.checked ? 'Verificado' : 'Não verificado',
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: PRIMARY, textColor: 255 },
        columnStyles: {
          0: { cellWidth: contentWidth - 40 },
          1: { cellWidth: 40, halign: 'center' },
        },
        margin: { left: margin, right: margin },
      });
      yPos = (doc as any).lastAutoTable.finalY + 6;
    });
  }
  yPos += 2;

  // ============ STEP 4 — EVIDÊNCIAS =================================
  sectionHeader('4. EVIDÊNCIAS');
  autoTable(doc, {
    startY: yPos,
    head: [['Descrição', 'Valor']],
    body: [
      ['Imagens postadas em outro meio', data.images_posted ? 'Sim' : 'Não'],
      ['Fotos Antes', `${data.fotos_antes_count} arquivo(s)`],
      ['Fotos Depois', `${data.fotos_depois_count} arquivo(s)`],
      ['Módulos Limpos (qtd)', String(data.modules_cleaned_qty || 0)],
      ['String Box (qtd)', String(data.string_box_qty || 0)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: PRIMARY, textColor: 255 },
    columnStyles: {
      0: { cellWidth: contentWidth - 60 },
      1: { cellWidth: 60, halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Photo grids — only if URLs were provided
  await renderPhotoGrid(doc, 'Fotos — Antes', data.fotos_antes_urls || [], {
    margin, contentWidth, pageHeight,
    getYPos: () => yPos, setYPos: (v) => { yPos = v; },
    checkNewPage,
  });
  await renderPhotoGrid(doc, 'Fotos — Depois', data.fotos_depois_urls || [], {
    margin, contentWidth, pageHeight,
    getYPos: () => yPos, setYPos: (v) => { yPos = v; },
    checkNewPage,
  });

  // ============ STEP 5 — FERRAMENTAS, EPIS E MEDIDAS PREVENTIVAS ====
  sectionHeader('5. FERRAMENTAS, EPIS E MEDIDAS PREVENTIVAS');
  const toolsChecklists = (data.checklists || []).filter(c =>
    TOOLS_CATEGORIES.includes(c.category) && c.items.length > 0
  );

  if (toolsChecklists.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Nenhum item registrado.', margin, yPos);
    yPos += 8;
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  } else {
    toolsChecklists.forEach((checklist) => {
      checkNewPage(28);
      const checkedCount = checklist.items.filter(i => i.checked).length;
      const totalCount = checklist.items.length;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text(
        `${categoryLabels[checklist.category] || checklist.category} (${checkedCount}/${totalCount})`,
        margin,
        yPos
      );
      yPos += 2;

      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Status']],
        body: checklist.items.map(item => [
          item.label,
          item.checked ? 'Utilizado / OK' : 'Não utilizado',
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: PRIMARY, textColor: 255 },
        columnStyles: {
          0: { cellWidth: contentWidth - 40 },
          1: { cellWidth: 40, halign: 'center' },
        },
        margin: { left: margin, right: margin },
      });
      yPos = (doc as any).lastAutoTable.finalY + 6;
    });
  }
  yPos += 2;

  // ============ STEP 6 — NOTAS E ASSINATURAS ========================
  sectionHeader('6. NOTAS E ASSINATURAS');

  // 6.1 Descrição do Serviço Realizado
  checkNewPage(40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('Descrição do Serviço Realizado', margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const servicosLines = doc.splitTextToSize(data.servicos_executados || '-', contentWidth);
  checkNewPage(servicosLines.length * 5 + 6);
  doc.text(servicosLines, margin, yPos);
  yPos += servicosLines.length * 5 + 6;

  // 6.2 Condições Encontradas
  checkNewPage(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Condições Encontradas', margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const condLines = doc.splitTextToSize(data.condicoes_encontradas || '-', contentWidth);
  checkNewPage(condLines.length * 5 + 6);
  doc.text(condLines, margin, yPos);
  yPos += condLines.length * 5 + 8;

  // 6.3 Materiais Utilizados
  if (data.materiais_utilizados && data.materiais_utilizados.length > 0) {
    checkNewPage(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Materiais Utilizados', margin, yPos);
    yPos += 2;
    autoTable(doc, {
      startY: yPos,
      head: [['Descrição', 'Quantidade', 'Em estoque']],
      body: data.materiais_utilizados.map(m => [
        m.descricao,
        String(m.quantidade),
        m.tinha_estoque ? 'Sim' : 'Não',
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      columnStyles: {
        0: { cellWidth: contentWidth - 70 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // 6.4 On-screen signatures (Técnico Responsável + Cliente)
  checkNewPage(60);
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('Assinatura do Técnico Responsável', margin, yPos);
  doc.text('Assinatura do Cliente', margin + sigBoxWidth + 10, yPos);
  yPos += 3;

  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, yPos, sigBoxWidth, sigBoxHeight);
  doc.rect(margin + sigBoxWidth + 10, yPos, sigBoxWidth, sigBoxHeight);

  if (data.assinatura_tecnico) {
    try {
      doc.addImage(data.assinatura_tecnico, 'PNG', margin + 2, yPos + 2, sigBoxWidth - 4, sigBoxHeight - 4);
    } catch { /* ignore unsupported dataURL */ }
  }
  if (data.assinatura_cliente) {
    try {
      doc.addImage(data.assinatura_cliente, 'PNG', margin + sigBoxWidth + 12, yPos + 2, sigBoxWidth - 4, sigBoxHeight - 4);
    } catch { /* ignore unsupported dataURL */ }
  }
  yPos += sigBoxHeight + 6;

  // Names below the boxes — full name of responsible technician under his signature
  const respNomeCompleto = data.signatures?.responsavel?.nome || data.tecnico_nome || '-';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(respNomeCompleto, margin + sigBoxWidth / 2, yPos, { align: 'center' });
  doc.text(
    data.nome_cliente_assinatura || data.cliente || '-',
    margin + sigBoxWidth + 10 + sigBoxWidth / 2,
    yPos,
    { align: 'center' }
  );
  yPos += 10;
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

  // ============ FOOTER (page numbers) ===============================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')} | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  return doc.output('blob');
};

// ===== Helpers =====================================================

interface PhotoGridCtx {
  margin: number;
  contentWidth: number;
  pageHeight: number;
  getYPos: () => number;
  setYPos: (v: number) => void;
  checkNewPage: (req?: number) => boolean;
}

const loadImage = (src: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    resolve(null);
    return;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

async function renderPhotoGrid(
  doc: jsPDF,
  title: string,
  urls: string[],
  ctx: PhotoGridCtx
) {
  if (!urls || urls.length === 0) return;
  ctx.checkNewPage(50);
  let yPos = ctx.getYPos();

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(title, ctx.margin, yPos);
  yPos += 6;
  ctx.setYPos(yPos);

  const cols = 3;
  const gap = 4;
  const cellWidth = (ctx.contentWidth - gap * (cols - 1)) / cols;
  const cellHeight = cellWidth * 0.75;

  for (let i = 0; i < urls.length; i++) {
    const col = i % cols;
    if (col === 0 && i > 0) {
      yPos += cellHeight + gap;
      ctx.setYPos(yPos);
    }
    ctx.checkNewPage(cellHeight + 10);
    yPos = ctx.getYPos();

    const x = ctx.margin + col * (cellWidth + gap);
    const img = await loadImage(urls[i]);
    if (img) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const c2d = canvas.getContext('2d');
        if (c2d) {
          c2d.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          doc.addImage(dataUrl, 'JPEG', x, yPos, cellWidth, cellHeight);
        }
      } catch {
        drawPhotoPlaceholder(doc, x, yPos, cellWidth, cellHeight);
      }
    } else {
      drawPhotoPlaceholder(doc, x, yPos, cellWidth, cellHeight);
    }
  }
  yPos += cellHeight + 8;
  ctx.setYPos(yPos);
}

function drawPhotoPlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(200, 200, 200);
  doc.rect(x, y, w, h);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Imagem indisponível', x + 2, y + h / 2);
  doc.setTextColor(0, 0, 0);
}

export const downloadRMEPDF = async (data: RMEPDFData, filename?: string): Promise<void> => {
  const blob = await generateRMEPDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `RME_${data.numero_os}_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
