import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type {
  Cliente,
  ClienteContaAzulId,
  ClienteEditableForm,
  ClienteUFV,
  PagedClientes,
} from '../types';
import { PAGE_SIZE } from '../types';

const SELECT_BASE = `
  id, empresa, cnpj_cpf, endereco, cidade, estado, cep,
  origem, solarz_customer_id, sem_solarz, ufv_solarz, prioridade,
  telefones_unificados, enderecos_unificados, sync_source_updated_at,
  created_at, updated_at, profile_id,
  profiles!clientes_profile_id_fkey(id, nome, email, telefone),
  cliente_ufvs(id, solarz_ufv_id, nome, endereco, cidade, estado, cep, potencia_kwp, status),
  cliente_conta_azul_ids(id, conta_azul_customer_id, nome_fiscal, cnpj_cpf, email)
` as const;

function mapRow(row: any): Cliente {
  const ufvs: ClienteUFV[] = Array.isArray(row?.cliente_ufvs) ? row.cliente_ufvs : [];
  const caIds: ClienteContaAzulId[] = Array.isArray(row?.cliente_conta_azul_ids)
    ? row.cliente_conta_azul_ids
    : [];

  return {
    id: row.id,
    empresa: row.empresa ?? '(sem nome)',
    cnpj_cpf: row.cnpj_cpf ?? null,
    endereco: row.endereco ?? null,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    cep: row.cep ?? null,
    origem: row.origem ?? null,
    solarz_customer_id: row.solarz_customer_id ?? null,
    sem_solarz: row.sem_solarz ?? null,
    ufv_solarz: row.ufv_solarz ?? null,
    prioridade: row.prioridade ?? null,
    observacoes: null, // observações não são persistidas no schema atual
    telefones_unificados: row.telefones_unificados ?? null,
    enderecos_unificados: row.enderecos_unificados ?? null,
    sync_source_updated_at: row.sync_source_updated_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    status: 'ativo',
    profile: row.profiles
      ? {
          id: row.profiles.id,
          nome: row.profiles.nome,
          email: row.profiles.email,
          telefone: row.profiles.telefone ?? null,
        }
      : null,
    ufvs: ufvs.map((u) => ({
      id: u.id,
      solarz_ufv_id: u.solarz_ufv_id,
      nome: u.nome ?? null,
      endereco: u.endereco ?? null,
      cidade: u.cidade ?? null,
      estado: u.estado ?? null,
      cep: u.cep ?? null,
      potencia_kwp: u.potencia_kwp ?? null,
      status: u.status ?? null,
    })),
    conta_azul_ids: caIds.map((c) => ({
      id: c.id,
      conta_azul_customer_id: c.conta_azul_customer_id,
      nome_fiscal: c.nome_fiscal ?? null,
      cnpj_cpf: c.cnpj_cpf ?? null,
      email: c.email ?? null,
    })),
  };
}

export const createClientService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchPage(params: {
      page: number;
      pageSize?: number;
      search?: string;
    }): Promise<PagedClientes> {
      const pageSize = params.pageSize ?? PAGE_SIZE;
      const from = (params.page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = db
        .from('clientes')
        .select(SELECT_BASE, { count: 'exact' })
        .order('empresa', { ascending: true, nullsFirst: false })
        .range(from, to);

      const search = params.search?.trim();
      if (search) {
        const term = `%${search}%`;
        query = query.or(
          [
            `empresa.ilike.${term}`,
            `cnpj_cpf.ilike.${term}`,
            `cidade.ilike.${term}`,
            `ufv_solarz.ilike.${term}`,
            `solarz_customer_id.ilike.${term}`,
          ].join(','),
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []).map(mapRow), total: count ?? 0 };
    },

    async fetchById(id: string): Promise<Cliente | null> {
      const { data, error } = await db
        .from('clientes')
        .select(SELECT_BASE)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data) : null;
    },

    async updateEditable(clienteId: string, data: ClienteEditableForm) {
      const { error } = await db
        .from('clientes')
        .update({
          ufv_solarz: data.ufv_solarz?.trim() ? data.ufv_solarz.trim() : null,
          prioridade: data.prioridade ?? 5,
        })
        .eq('id', clienteId);
      if (error) throw error;
    },

    // --- Moved from useClientDashData (inline queries) ---

    async fetchClientByProfile(profileId: string) {
      const { data } = await db
        .from('clientes')
        .select('*, profiles(nome, email, telefone)')
        .eq('profile_id', profileId)
        .single();
      return data;
    },

    async fetchClientTickets(clienteId: string) {
      const { data } = await db
        .from('tickets')
        .select('*, ordens_servico(numero_os, id, data_programada, hora_inicio), prestadores:tecnico_responsavel_id(nome, email, telefone)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      return data || [];
    },

    async fetchClientEquipments(clienteId: string) {
      const { data } = await db
        .from('equipamentos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      return data || [];
    },

    async fetchClientRMEs(ticketIds: string[]) {
      const { data } = await db
        .from('rme_relatorios')
        .select('*, tickets(numero_ticket, titulo), ordens_servico(numero_os), tecnicos(id, profiles(nome))')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  };
};

export const clientService = createClientService();
