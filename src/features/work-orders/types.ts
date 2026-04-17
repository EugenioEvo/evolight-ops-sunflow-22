export interface WorkOrder {
  id: string;
  numero_os: string;
  data_emissao: string;
  data_programada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  site_name: string | null;
  work_type: string[];
  servico_solicitado: string | null;
  inspetor_responsavel: string | null;
  equipe: string[] | null;
  notes: string | null;
  aceite_tecnico: string;
  motivo_recusa: string | null;
  tecnico_id: string | null;
  pdf_url: string | null;
  tickets: {
    id: string;
    titulo: string;
    status: string;
    prioridade: string;
    endereco_servico: string;
    clientes: {
      empresa: string;
      ufv_solarz: string | null;
      prioridade: number | null;
    };
  };
  rme_relatorios: Array<{
    id: string;
    status: string;
  }>;
}


export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  aberta: { label: "Aberta", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: "FileText" },
  em_execucao: { label: "Em Execução", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: "PlayCircle" },
  concluida: { label: "Concluída", color: "bg-green-500/10 text-green-600 border-green-200", icon: "CheckCircle2" },
  cancelada: { label: "Cancelada", color: "bg-red-500/10 text-red-600 border-red-200", icon: "XCircle" },
};

export const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  media: { label: "Média", color: "bg-blue-100 text-blue-700" },
  alta: { label: "Alta", color: "bg-amber-100 text-amber-700" },
  critica: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

export const ITEMS_PER_PAGE = 18;
