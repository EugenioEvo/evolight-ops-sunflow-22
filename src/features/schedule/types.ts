export interface AgendaOrdemServico {
  id: string;
  numero_os: string;
  data_programada: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_estimada_min: number | null;
  tecnico_id: string;
  calendar_invite_sent_at: string | null;
  calendar_invite_recipients: string[] | null;
  presence_confirmed_at: string | null;
  presence_confirmed_by: string | null;
  email_error_log: any[] | null;
  qr_code: string | null;
  tecnicos: {
    id: string;
    profile_id: string;
    profiles: {
      nome: string;
      email: string | null;
    };
  } | null;
  tickets: {
    numero_ticket: string;
    titulo: string;
    endereco_servico: string;
    status: string;
    prioridade: string;
    clientes: {
      empresa: string;
    };
  };
}

export interface Tecnico {
  id: string;
  nome: string;
}
