import { supabase } from "@/integrations/supabase/client";

export const technicianService = {
  async fetchAll() {
    const { data, error } = await supabase
      .from("tecnicos")
      .select(`
        *,
        profiles:profile_id (
          id, nome, email, telefone, ativo
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async update(id: string, data: {
    especialidades?: string[];
    regiao_atuacao?: string;
    registro_profissional?: string;
  }) {
    const { error } = await supabase
      .from("tecnicos")
      .update(data)
      .eq("id", id);

    if (error) throw error;
  },

  async toggleActive(profileId: string, currentActive: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ ativo: !currentActive })
      .eq("id", profileId);

    if (error) throw error;
  },
};
