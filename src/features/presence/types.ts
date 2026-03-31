export interface OrdemServicoPresenca {
  id: string;
  numero_os: string;
  data_programada: string;
  hora_inicio: string;
  hora_fim: string;
  presence_confirmed_at: string | null;
  presence_confirmed_by: string | null;
  ticket_id: string;
  tecnico_id: string;
  tecnicos: {
    id: string;
    profiles: {
      nome: string;
    };
  } | null;
  tickets: {
    numero_ticket: string;
    titulo: string;
    endereco_servico: string;
    clientes: {
      empresa: string;
    } | null;
  } | null;
}

export interface PresenceTecnico {
  id: string;
  profiles: {
    nome: string;
  };
}
