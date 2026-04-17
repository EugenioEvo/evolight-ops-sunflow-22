/** Typed interfaces for report data */

export interface ReportTicket {
  id: string;
  numero_ticket: string;
  titulo: string;
  status: string;
  prioridade: string;
  created_at: string;
  tecnico_responsavel_id: string | null;
  clientes: {
    empresa: string | null;
    profiles: { nome: string } | null;
  } | null;
}

export interface ReportRME {
  id: string;
  tecnico_id: string;
  /** Unified status: rascunho|pendente|aprovado|rejeitado */
  status: string;
  data_aprovacao: string | null;
  created_at: string;
  tickets: {
    titulo: string;
    numero_ticket: string;
  } | null;
  tecnicos: {
    profiles: { nome: string } | null;
  } | null;
}

export interface ReportOS {
  id: string;
  numero_os: string;
  created_at: string;
  tickets: { titulo: string } | null;
  tecnicos: { profiles: { nome: string } | null } | null;
}

export interface ReportTecnico {
  id: string;
  profiles: { nome: string; email: string | null };
}

export interface ReportCliente {
  id: string;
  empresa: string | null;
  profiles: { nome: string; email: string | null } | null;
}
