/**
 * Single source of truth for RME status semantics.
 *
 * After unification (April 2026) the database column `rme_relatorios.status`
 * carries the full lifecycle. The legacy `status_aprovacao` column was dropped.
 *
 *   rascunho  → editável pelo técnico, ainda não submetido
 *   pendente  → submetido para avaliação, edição bloqueada
 *   aprovado  → aprovado pelo avaliador, edição bloqueada
 *   rejeitado → rejeitado pelo avaliador, técnico pode editar e re-submeter
 */
export type RMEStatus = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';

export const RME_STATUS_LABEL: Record<RMEStatus, string> = {
  rascunho: 'Rascunho',
  pendente: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

/** Tailwind classes used in badges across the app. */
export const RME_STATUS_BADGE_CLASS: Record<RMEStatus, string> = {
  rascunho: 'bg-slate-500/10 text-slate-600 border-slate-200',
  pendente: 'bg-amber-500/10 text-amber-600 border-amber-200',
  aprovado: 'bg-green-500/10 text-green-600 border-green-200',
  rejeitado: 'bg-red-500/10 text-red-600 border-red-200',
};

export const isRMEEditable = (status: string | null | undefined): boolean =>
  status === 'rascunho' || status === 'rejeitado';

export const isRMELocked = (status: string | null | undefined): boolean =>
  status === 'pendente' || status === 'aprovado';

export const isRMEApproved = (status: string | null | undefined): boolean =>
  status === 'aprovado';

export const normalizeRMEStatus = (raw: string | null | undefined): RMEStatus => {
  if (raw === 'pendente' || raw === 'aprovado' || raw === 'rejeitado' || raw === 'rascunho') return raw;
  // Legacy fallback: any unknown value defaults to rascunho.
  return 'rascunho';
};
