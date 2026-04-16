import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RMEPDFData {
  numero_os: string;
  cliente: string;
  endereco: string;
  site_name: string;
  data_execucao: string;
  weekday: string;
  shift: string;
  start_time: string;
  end_time: string;
  service_type: string[];
  collaboration: string[];
  checklists: {
    category: string;
    items: { label: string; checked: boolean }[];
  }[];
  images_posted: boolean;
  modules_cleaned_qty: number;
  string_box_qty: number;
  fotos_antes_count: number;
  fotos_depois_count: number;
  materiais_utilizados: Array<{
    descricao: string;
    quantidade: number;
    tinha_estoque: boolean;
  }>;
  servicos_executados: string;
  condicoes_encontradas: string;
  signatures: {
    responsavel?: { nome: string; at: string };
    gerente_manutencao?: { nome: string; at: string };
    gerente_projeto?: { nome: string; at: string };
  };
  tecnico_nome: string;
  status_aprovacao: string;
  ufv_solarz?: string;
  /** Image URLs (signed) for "before" pictures — embedded as image previews. */
  fotos_antes_urls?: string[];
  /** Image URLs (signed) for "after" pictures — embedded as image previews. */
  fotos_depois_urls?: string[];
  /** PNG DataURL of the on-screen technician signature. */
  assinatura_tecnico?: string;
  /** PNG DataURL of the on-screen client signature. */
  assinatura_cliente?: string;
  /** Printed name of the client signing on-screen. */
  nome_cliente_assinatura?: string;
}

const categoryLabels: Record<string, string> = {
  inspecao_visual: 'Inspeção Visual',
  limpeza: 'Limpeza',
  verificacao_eletrica: 'Verificação Elétrica',
  testes: 'Testes',
  ferramentas: 'Ferramentas',
  epis: 'EPIs',
  medidas_preventivas: 'Medidas Preventivas',
};

const serviceTypeLabels: Record<string, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  emergencial: 'Emergencial',
  instalacao: 'Instalação',
  vistoria: 'Vistoria',
};

const shiftLabels: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export const generateRMEPDF = async (data: RMEPDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPos = 20;

  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(63, 81, 181);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE MANUTENÇÃO EXECUTADA', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS: ${data.numero_os}`, pageWidth / 2, 25, { align: 'center' });
  
  // Status badge
  const statusColor = data.status_aprovacao === 'aprovado' ? [34, 197, 94] : 
                      data.status_aprovacao === 'rejeitado' ? [239, 68, 68] : [234, 179, 8];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(pageWidth - 50, 8, 40, 8, 2, 2, 'F');
  doc.setFontSize(8);
  doc.text(data.status_aprovacao.toUpperCase(), pageWidth - 30, 13, { align: 'center' });

  yPos = 45;
  doc.setTextColor(0, 0, 0);

  // Section: Identification
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(63, 81, 181);
  doc.text('IDENTIFICAÇÃO', margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const identificationData: [string, string][] = [
    ['Cliente:', data.cliente],
  ];

  // Add UFV/SolarZ right after cliente
  if (data.ufv_solarz) {
    identificationData.push(['UFV/SolarZ:', data.ufv_solarz]);
  }

  identificationData.push(
    ['Endereço:', data.endereco],
    ['Site:', data.site_name || '-'],
    ['Data de Execução:', data.data_execucao],
    ['Dia da Semana:', data.weekday || '-'],
    ['Técnico Responsável:', data.tecnico_nome],
  );

  identificationData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 45, yPos);
    yPos += 6;
  });

  yPos += 5;

  // Section: Shift and Time
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(63, 81, 181);
  doc.text('TURNO E HORÁRIOS', margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const shiftData = [
    ['Turno:', shiftLabels[data.shift] || data.shift || '-'],
    ['Hora Início:', data.start_time || '-'],
    ['Hora Fim:', data.end_time || '-'],
  ];

  shiftData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 30, yPos);
    yPos += 6;
  });

  yPos += 5;

  // Section: Service Type
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(63, 81, 181);
  doc.text('TIPO DE SERVIÇO', margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  const serviceTypes = ['preventiva', 'corretiva', 'emergencial', 'instalacao', 'vistoria'];
  let xPos = margin;
  serviceTypes.forEach((type) => {
    const isChecked = data.service_type.includes(type);
    doc.setFont('helvetica', 'normal');
    doc.text(isChecked ? '☑' : '☐', xPos, yPos);
    doc.text(serviceTypeLabels[type], xPos + 5, yPos);
    xPos += 35;
  });

  yPos += 10;

  // Section: Collaboration
  if (data.collaboration && data.collaboration.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(63, 81, 181);
    doc.text('COLABORADORES', margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(data.collaboration.join(', '), margin, yPos);
    yPos += 10;
  }

  // Section: Checklists
  checkNewPage(40);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(63, 81, 181);
  doc.text('CHECKLISTS OPERACIONAIS', margin, yPos);
  yPos += 8;

  data.checklists.forEach((checklist) => {
    if (checklist.items.length === 0) return;
    
    checkNewPage(30);

    const checkedCount = checklist.items.filter(i => i.checked).length;
    const totalCount = checklist.items.length;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${categoryLabels[checklist.category] || checklist.category} (${checkedCount}/${totalCount})`, margin, yPos);
    yPos += 2;

    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Status']],
      body: checklist.items.map(item => [
        item.label,
        item.checked ? '✓ Verificado' : '✗ Não verificado'
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [63, 81, 181], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 40, halign: 'center' }
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  });

  // Section: Evidence Summary
  checkNewPage(50);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(63, 81, 181);
  doc.text('EVIDÊNCIAS E QUANTITATIVOS', margin, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [['Descrição', 'Valor']],
    body: [
      ['Imagens Postadas', data.images_posted ? 'Sim' : 'Não'],
      ['Fotos Antes', `${data.fotos_antes_count} arquivo(s)`],
      ['Fotos Depois', `${data.fotos_depois_count} arquivo(s)`],
      ['Módulos Limpos (qtd)', String(data.modules_cleaned_qty || 0)],
      ['String Box (qtd)', String(data.string_box_qty || 0)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [63, 81, 181], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 60, halign: 'center' }
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Section: Materials
  if (data.materiais_utilizados && data.materiais_utilizados.length > 0) {
    checkNewPage(40);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(63, 81, 181);
    doc.text('MATERIAIS UTILIZADOS', margin, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Descrição', 'Quantidade', 'Tinha Estoque']],
      body: data.materiais_utilizados.map(m => [
        m.descricao,
        String(m.quantidade),
        m.tinha_estoque ? 'Sim' : 'Não'
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [63, 81, 181], textColor: 255 },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Section: Service Description
  checkNewPage(60);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(63, 81, 181);
  doc.text('DESCRIÇÃO DO SERVIÇO', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Condições Encontradas:', margin, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  const condicoesLines = doc.splitTextToSize(data.condicoes_encontradas || '-', pageWidth - 2 * margin);
  doc.text(condicoesLines, margin, yPos);
  yPos += condicoesLines.length * 5 + 8;

  checkNewPage(40);

  doc.setFont('helvetica', 'bold');
  doc.text('Serviços Executados:', margin, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  const servicosLines = doc.splitTextToSize(data.servicos_executados || '-', pageWidth - 2 * margin);
  doc.text(servicosLines, margin, yPos);
  yPos += servicosLines.length * 5 + 10;

  // Helper: load an image (URL or DataURL) into the PDF, skipping silently on failure.
  const loadImage = (src: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  const renderPhotoGrid = async (title: string, urls: string[]) => {
    if (!urls || urls.length === 0) return;
    checkNewPage(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(63, 81, 181);
    doc.text(title, margin, yPos);
    yPos += 8;

    const cols = 3;
    const gap = 4;
    const cellWidth = (pageWidth - 2 * margin - gap * (cols - 1)) / cols;
    const cellHeight = cellWidth * 0.75;

    for (let i = 0; i < urls.length; i++) {
      const col = i % cols;
      if (col === 0 && i > 0) yPos += cellHeight + gap;
      checkNewPage(cellHeight + 10);
      const img = await loadImage(urls[i]);
      const x = margin + col * (cellWidth + gap);
      if (img) {
        try {
          // Convert via canvas to ensure jsPDF can embed it
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            doc.addImage(dataUrl, 'JPEG', x, yPos, cellWidth, cellHeight);
          }
        } catch {
          doc.setDrawColor(200, 200, 200);
          doc.rect(x, yPos, cellWidth, cellHeight);
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text('Imagem indisponível', x + 2, yPos + cellHeight / 2);
        }
      } else {
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, yPos, cellWidth, cellHeight);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Imagem indisponível', x + 2, yPos + cellHeight / 2);
      }
    }
    yPos += cellHeight + 10;
  };

  await renderPhotoGrid('FOTOS — ANTES', data.fotos_antes_urls || []);
  await renderPhotoGrid('FOTOS — DEPOIS', data.fotos_depois_urls || []);

  // Section: On-screen Canvas Signatures (Technician + Client)
  if (data.assinatura_tecnico || data.assinatura_cliente) {
    checkNewPage(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(63, 81, 181);
    doc.text('ASSINATURAS — TÉCNICO E CLIENTE', margin, yPos);
    yPos += 8;

    const sigBoxWidth = (pageWidth - 2 * margin - 10) / 2;
    const sigBoxHeight = 40;
    const placeSig = (label: string, dataUrl: string | undefined, name: string | undefined, xOffset: number) => {
      const x = margin + xOffset;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(label, x, yPos);
      doc.setDrawColor(0, 0, 0);
      doc.rect(x, yPos + 2, sigBoxWidth, sigBoxHeight);
      if (dataUrl) {
        try { doc.addImage(dataUrl, 'PNG', x + 2, yPos + 4, sigBoxWidth - 4, sigBoxHeight - 4); } catch { /* ignore */ }
      }
      if (name) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(name, x, yPos + sigBoxHeight + 8);
      }
    };
    placeSig('Técnico', data.assinatura_tecnico, data.tecnico_nome, 0);
    placeSig('Cliente', data.assinatura_cliente, data.nome_cliente_assinatura, sigBoxWidth + 10);
    yPos += sigBoxHeight + 18;
  }

  // Section: Internal Approval Signatures (text-based)
  checkNewPage(60);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(63, 81, 181);
  doc.text('APROVAÇÕES INTERNAS', margin, yPos);
  yPos += 10;

  const signatureLabels: Record<string, string> = {
    responsavel: 'Responsável Técnico',
    gerente_manutencao: 'Gerente de Manutenção',
    gerente_projeto: 'Gerente de Projeto',
  };

  const signatureWidth = (pageWidth - 2 * margin - 20) / 3;
  let sigXPos = margin;

  Object.entries(signatureLabels).forEach(([key, label]) => {
    const signature = data.signatures[key as keyof typeof data.signatures];
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(label, sigXPos, yPos);
    
    doc.setDrawColor(0, 0, 0);
    doc.line(sigXPos, yPos + 15, sigXPos + signatureWidth, yPos + 15);
    
    if (signature?.nome) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(signature.nome, sigXPos, yPos + 20);
      
      if (signature.at) {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(signature.at, sigXPos, yPos + 25);
      }
    }
    
    sigXPos += signatureWidth + 10;
  });

  yPos += 35;

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return doc.output('blob');
};

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
