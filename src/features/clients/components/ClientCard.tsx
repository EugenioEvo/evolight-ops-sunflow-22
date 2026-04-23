import { Building2, Mail, MapPin, Phone, Sun, FileText, Star, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Cliente } from '../types';

interface ClientCardProps {
  cliente: Cliente;
  onOpen: () => void;
}

const ORIGEM_LABEL: Record<string, { label: string; className: string }> = {
  solarz: {
    label: 'Solarz',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  conta_azul: {
    label: 'Conta Azul',
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  },
  manual: {
    label: 'Manual',
    className: 'bg-muted text-muted-foreground border-border',
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
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground text-base leading-tight">
                {cliente.empresa}
              </h3>
              <Badge variant="outline" className={`text-xs ${origemMeta.className}`}>
                {origemMeta.label}
              </Badge>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Star className="h-3 w-3" />P{cliente.prioridade ?? 5}
              </Badge>
              {cliente.ufv_solarz && (
                <Badge variant="outline" className="text-xs">
                  UFV/SolarZ: {cliente.ufv_solarz}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-foreground">{cliente.cnpj_cpf || '—'}</span>
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
                  <span className="text-foreground">{cliente.profile.telefone}</span>
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