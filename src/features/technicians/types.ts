export interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
}

export interface Tecnico {
  id: string;
  profile_id: string;
  especialidades: string[];
  regiao_atuacao: string;
  registro_profissional: string;
  profiles: Profile;
}
