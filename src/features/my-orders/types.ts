export interface OrdemServico {
  id: string;
  numero_os: string;
  data_emissao: string;
  data_programada: string | null;
  pdf_url: string | null;
  ticket_id: string;
  hora_inicio?: string;
  hora_fim?: string;
  equipe?: string[];
  servico_solicitado?: string;
  inspetor_responsavel?: string;
  tipo_trabalho?: string[];
  aceite_tecnico?: string;
  aceite_at?: string;
  motivo_recusa?: string;
  rme_relatorios?: Array<{ id: string; status: string }>;
  tickets: {
    id: string;
    numero_ticket: string;
    titulo: string;
    descricao?: string;
    endereco_servico: string;
    prioridade: string;
    status: string;
    data_inicio_execucao: string | null;
    clientes: {
      empresa: string;
      endereco?: string;
      cidade?: string;
      estado?: string;
      profiles?: {
        telefone?: string;
      };
    };
  };
}
