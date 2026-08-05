export type ActivityTipo = 'RME' | 'RDO' | 'OS';

export interface ActivityRow {
  id: string;
  tipo: ActivityTipo;
  data: string; // yyyy-MM-dd
  pessoaId: string | null;
  pessoaNome: string;
  destino: string; // Obra (RDO) | Cliente (RME)
  numero: string;
  status: string | null;
  horasMeta: number | null;
  horasReais: number | null;
  link: string;
}
