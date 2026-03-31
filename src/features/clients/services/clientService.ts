import { supabase } from "@/integrations/supabase/client";
import type { ClienteForm, Cliente, ESTADOS_BR } from "../types";

export const clientService = {
  async fetchAll(): Promise<Cliente[]> {
    const { data, error } = await supabase
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
    const { error } = await supabase
      .from('clientes')
      .insert({
        profile_id: null,
        empresa: data.empresa,
        cnpj_cpf: data.cnpj_cpf,
        endereco: data.endereco,
        cidade: data.cidade,
        estado: data.estado,
        cep: data.cep,
        ufv_solarz: data.ufv_solarz || null,
        prioridade: data.prioridade ?? 5
      });
    if (error) throw error;
  },

  async update(clienteId: string, profileId: string | undefined, data: ClienteForm) {
    if (profileId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: data.empresa,
          email: data.email || data.empresa.toLowerCase().replace(/\s+/g, '') + '@cliente.com',
          telefone: data.telefone
        })
        .eq('id', profileId);
      if (profileError) throw profileError;
    }

    const { error } = await supabase
      .from('clientes')
      .update({
        empresa: data.empresa,
        cnpj_cpf: data.cnpj_cpf,
        endereco: data.endereco,
        cidade: data.cidade,
        estado: data.estado,
        cep: data.cep,
        ufv_solarz: data.ufv_solarz || null,
        prioridade: data.prioridade ?? 5
      })
      .eq('id', clienteId);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;
  }
};
