import type { AppSupabaseClient } from '@/shared/services/baseService';
import { getClient } from '@/shared/services/baseService';
import type { ClienteForm, Cliente, ESTADOS_BR } from "../types";

export const createClientService = (client?: AppSupabaseClient) => {
  const db = getClient(client);

  return {
    async fetchAll(): Promise<Cliente[]> {
      const { data, error } = await db
        .from('clientes')
        .select(`*, profiles!clientes_profile_id_fkey(id, nome, email, telefone)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((cliente) => ({
        id: cliente.id,
        empresa: cliente.empresa || '',
        cnpj_cpf: cliente.cnpj_cpf || '',
        endereco: cliente.endereco || '',
        cidade: cliente.cidade || '',
        estado: (cliente.estado || 'SP') as typeof ESTADOS_BR[number],
        cep: cliente.cep || '',
        telefone: cliente.profiles?.telefone || '',
        email: cliente.profiles?.email || '',
        ufv_solarz: cliente.ufv_solarz || '',
        prioridade: cliente.prioridade ?? 5,
        observacoes: '',
        status: 'ativo' as const,
        profile: cliente.profiles
      }));
    },

    async create(data: ClienteForm) {
      const { error } = await db.from('clientes').insert({
        profile_id: null, empresa: data.empresa, cnpj_cpf: data.cnpj_cpf,
        endereco: data.endereco, cidade: data.cidade, estado: data.estado,
        cep: data.cep, ufv_solarz: data.ufv_solarz || null, prioridade: data.prioridade ?? 5
      });
      if (error) throw error;
    },

    async update(clienteId: string, profileId: string | undefined, data: ClienteForm) {
      if (profileId) {
        const { error: profileError } = await db.from('profiles').update({
          nome: data.empresa,
          email: data.email || data.empresa.toLowerCase().replace(/\s+/g, '') + '@cliente.com',
          telefone: data.telefone
        }).eq('id', profileId);
        if (profileError) throw profileError;
      }
      const { error } = await db.from('clientes').update({
        empresa: data.empresa, cnpj_cpf: data.cnpj_cpf, endereco: data.endereco,
        cidade: data.cidade, estado: data.estado, cep: data.cep,
        ufv_solarz: data.ufv_solarz || null, prioridade: data.prioridade ?? 5
      }).eq('id', clienteId);
      if (error) throw error;
    },

    async delete(id: string) {
      const { error } = await db.from('clientes').delete().eq('id', id);
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
