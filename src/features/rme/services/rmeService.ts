import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import { downloadRMEPDF, RMEPDFData } from '@/utils/generateRMEPDF';
import type { RMERow } from '../hooks/useRMEActions';
import type { TablesInsert } from '@/integrations/supabase/types';

export const createRmeService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchRMEs() {
      const { data, error } = await db
        .from('rme_relatorios')
        .select(`*, status_aprovacao, aprovado_por, data_aprovacao, observacoes_aprovacao,
          tickets!inner(titulo, numero_ticket, endereco_servico, clientes!inner(empresa, endereco, ufv_solarz)),
          tecnicos!inner(profiles!inner(nome))`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async fetchOSById(osId: string) {
      const { data, error } = await db
        .from('ordens_servico')
        .select(`*, tickets!inner(*, clientes(empresa))`)
        .eq('id', osId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async uploadPhotos(files: File[], folder: string, userId: string): Promise<string[]> {
      const urls: string[] = [];
      for (const file of files) {
        const fileName = `${userId}/${folder}/${Date.now()}_${file.name}`;
        const { error } = await db.storage.from('rme-fotos').upload(fileName, file);
        if (error) throw error;
        // Use signed URL since bucket is not public
        const { data } = await db.storage.from('rme-fotos').createSignedUrl(fileName, 60 * 60 * 24 * 365);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      return urls;
    },

    async getTecnicoId(profileId: string): Promise<string | undefined> {
      const { data } = await db.from('tecnicos').select('id').eq('profile_id', profileId).single();
      return data?.id;
    },

    async createRME(rmeData: TablesInsert<'rme_relatorios'>) {
      const { error } = await db.from('rme_relatorios').insert([rmeData]);
      if (error) throw error;
    },

    async markTicketConcluido(ticketId: string) {
      const { error } = await db.from('tickets').update({ status: 'concluido', data_conclusao: new Date().toISOString() }).eq('id', ticketId);
      if (error) throw error;
    },

    async searchEquipmentByQR(qrData: Record<string, string>) {
      let query = db.from('equipamentos').select('*');
      const searchCriteria: string[] = [];
      if (qrData.id) searchCriteria.push(`id.eq.${qrData.id}`);
      if (qrData.numero_serie) searchCriteria.push(`numero_serie.eq.${qrData.numero_serie}`);
      if (qrData.codigo) {
        searchCriteria.push(`numero_serie.eq.${qrData.codigo}`);
        searchCriteria.push(`id.eq.${qrData.codigo}`);
      }
      if (searchCriteria.length > 0) {
        query = query.or(searchCriteria.join(','));
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },

    async exportRMEPDF(rme: RMERow) {
      const { data: checklistItems } = await db.from('rme_checklist_items').select('*').eq('rme_id', rme.id).order('category, item_key');
      const { data: osData } = await db.from('ordens_servico').select('numero_os').eq('id', rme.ordem_servico_id).single();

      const checklistMap: Record<string, { label: string; checked: boolean }[]> = {};
      (checklistItems || []).forEach((item) => {
        if (!checklistMap[item.category]) checklistMap[item.category] = [];
        checklistMap[item.category].push({ label: item.label, checked: !!item.checked });
      });

      const checklists = Object.entries(checklistMap).map(([category, items]) => ({ category, items }));

      const pdfData: RMEPDFData = {
        numero_os: osData?.numero_os || '-',
        cliente: rme.tickets?.clientes?.empresa || '-',
        endereco: rme.tickets?.endereco_servico || rme.tickets?.clientes?.endereco || '-',
        site_name: rme.site_name || '-',
        data_execucao: new Date(rme.data_execucao).toLocaleDateString('pt-BR'),
        weekday: rme.weekday || '-',
        shift: rme.shift || '-',
        start_time: rme.start_time || '-',
        end_time: rme.end_time || '-',
        service_type: Array.isArray(rme.service_type) ? rme.service_type : [],
        collaboration: Array.isArray(rme.collaboration) ? rme.collaboration : [],
        checklists,
        images_posted: !!rme.images_posted,
        modules_cleaned_qty: rme.modules_cleaned_qty || 0,
        string_box_qty: rme.string_box_qty || 0,
        fotos_antes_count: rme.fotos_antes?.length || 0,
        fotos_depois_count: rme.fotos_depois?.length || 0,
        materiais_utilizados: Array.isArray(rme.materiais_utilizados)
          ? rme.materiais_utilizados.map((m) => ({
              descricao: m.nome || m.descricao || '-',
              quantidade: m.quantidade || 0,
              tinha_estoque: !!m.tinha_estoque,
            }))
          : [],
        servicos_executados: rme.servicos_executados || '-',
        condicoes_encontradas: rme.condicoes_encontradas || '-',
        signatures: rme.signatures || {},
        tecnico_nome: rme.tecnicos?.profiles?.nome || '-',
        status_aprovacao: rme.status_aprovacao || 'pendente',
        ufv_solarz: rme.tickets?.clientes?.ufv_solarz || undefined,
        fotos_antes_urls: Array.isArray(rme.fotos_antes) ? rme.fotos_antes : [],
        fotos_depois_urls: Array.isArray(rme.fotos_depois) ? rme.fotos_depois : [],
        assinatura_tecnico: (rme as any).assinatura_tecnico || undefined,
        assinatura_cliente: (rme as any).assinatura_cliente || undefined,
        nome_cliente_assinatura: (rme as any).nome_cliente_assinatura || undefined,
      };

      await downloadRMEPDF(pdfData, `RME_${osData?.numero_os || rme.id}_${new Date(rme.data_execucao).toISOString().split('T')[0]}.pdf`);
    },

    async sendRMEEmail(rmeId: string) {
      const { data, error } = await db.functions.invoke('send-rme-email', { body: { rme_id: rmeId } });
      if (error) throw error;
      return data;
    },
  };
};

export const rmeService = createRmeService();
