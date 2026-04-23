import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Sun,
  FileText,
  Star,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  CircleSlash,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Cliente, StatusFinanceiroCA, UfvStatusResumo } from '../types';
import { formatCpfCnpj, formatPhone, formatBRL } from '../utils/format';

interface ClientCardProps {
  cliente: Cliente;
  onOpen: () => void;
}

const ORIGEM_LABEL: Record<string, { label: string; className: string }> = {
  solarz: {
    label: 'Solarz',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  conta_azul: {
    label: 'Conta Azul',
    className:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  },
  manual: {
    label: 'Manual',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

const UFV_STATUS_META: Record<
  string,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  OK: {
    label: 'UFVs OK',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  ALERTA: {
    label: 'UFVs em alerta',
    className:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    Icon: AlertTriangle,
  },
  SEM_UFV: {
    label: 'Sem UFV',
    className: 'bg-muted text-muted-foreground border-border',
    Icon: CircleSlash,
  },
};

const FIN_STATUS_META: Record<
  string,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  OK: {
    label: 'Em dia',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  INADIMPLENTE: {
    label: 'Inadimplente',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    Icon: CircleAlert,
  },
};

function formatLocation(cliente: Cliente) {
  const parts = [cliente.cidade, cliente.estado].filter(Boolean).join('/');
  return parts || '—';
}

function formatLastSync(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return null;
  }
}

function UfvBadge({ status }: { status: UfvStatusResumo | null }) {
  if (!status) return null;
  const meta = UFV_STATUS_META[status] ?? UFV_STATUS_META.SEM_UFV;
  const { Icon } = meta;
  return (
    <Badge variant="outline" className={`text-xs flex items-center gap-1 ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function FinBadge({
  status,
  valor,
}: {
  status: StatusFinanceiroCA | null;
  valor: number | null;
}) {
  if (!status) return null;
  const meta = FIN_STATUS_META[status] ?? FIN_STATUS_META.OK;
  const { Icon } = meta;
  const tip =
    status === 'INADIMPLENTE' && valor != null
      ? `Em atraso: ${formatBRL(valor)} (Conta Azul)`
      : status === 'OK'
        ? 'Sem pendências financeiras no Conta Azul'
        : meta.label;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs flex items-center gap-1 ${meta.className}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ClientCard({ cliente, onOpen }: ClientCardProps) {
  const origem = (cliente.origem ?? 'manual').toLowerCase();
  const origemMeta = ORIGEM_LABEL[origem] ?? ORIGEM_LABEL.manual;
  const lastSync = formatLastSync(cliente.sync_source_updated_at);
  const ufvCount = cliente.ufvs.length;
  const caCount = cliente.conta_azul_ids.length;
  const totalKwp = cliente.ufvs.reduce(
    (sum, ufv) => sum + (Number.isFinite(ufv.potencia_kwp ?? NaN) ? Number(ufv.potencia_kwp) : 0),
    0,
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground text-base leading-tight">
                {cliente.empresa}
              </h3>
              <Badge variant="outline" className={`text-xs ${origemMeta.className}`}>
                {origemMeta.label}
              </Badge>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Star className="h-3 w-3" />P{cliente.prioridade ?? 5}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Prioridade do cliente — escala 1 a 5. Quanto menor, mais urgente.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <UfvBadge status={cliente.ufv_status_resumo} />
              <FinBadge
                status={cliente.status_financeiro_ca}
                valor={cliente.atrasos_recebimentos}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-foreground">{formatCpfCnpj(cliente.cnpj_cpf)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="text-foreground truncate">{formatLocation(cliente)}</span>
              </div>
              {cliente.profile?.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail className="h-4 w-4" />
                  <span className="text-foreground truncate">{cliente.profile.email}</span>
                </div>
              )}
              {cliente.profile?.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span className="text-foreground">{formatPhone(cliente.profile.telefone)}</span>
                </div>
              )}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onOpen} className="shrink-0">
            Detalhes
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60 text-xs">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sun className="h-3 w-3" />
            {ufvCount} UFV{ufvCount === 1 ? '' : 's'}
            {totalKwp > 0 && ` · ${totalKwp.toFixed(2)} kWp`}
          </Badge>
          <Badge variant="secondary">
            {caCount} ID{caCount === 1 ? '' : 's'} Conta Azul
          </Badge>
          {lastSync && (
            <Badge variant="outline" className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Sync: {lastSync}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
