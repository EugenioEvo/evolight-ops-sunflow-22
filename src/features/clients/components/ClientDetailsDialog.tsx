import {
  Lock,
  Sun,
  Database,
  MapPin,
  Phone,
  Mail,
  Building2,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  CircleSlash,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { UseFormReturn } from 'react-hook-form';
import type { Cliente, ClienteEditableForm } from '../types';
import { formatBRL, formatCep, formatCpfCnpj, formatPhone, formatPhoneLines } from '../utils/format';

interface ClientDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
  form: UseFormReturn<ClienteEditableForm>;
  saving: boolean;
  onSubmit: (data: ClienteEditableForm) => void | Promise<void>;
}

function ReadOnlyField({
  label,
  value,
  hint,
  multiline,
}: {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  multiline?: boolean;
}) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="h-3 w-3" />
        {label}
      </div>
      {multiline ? (
        <pre className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words font-sans">
          {display}
        </pre>
      ) : (
        <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-foreground break-words">
          {display}
        </div>
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const UFV_BADGE: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
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

const FIN_BADGE: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
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

export function ClientDetailsDialog({
  open,
  onOpenChange,
  cliente,
  form,
  saving,
  onSubmit,
}: ClientDetailsDialogProps) {
  if (!cliente) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cliente</DialogTitle>
            <DialogDescription>Nenhum cliente selecionado.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const origemLabel = (cliente.origem ?? 'manual').toLowerCase();
  const lastSync = cliente.sync_source_updated_at
    ? new Date(cliente.sync_source_updated_at).toLocaleString('pt-BR')
    : '—';

  const ufvMeta = cliente.ufv_status_resumo
    ? UFV_BADGE[cliente.ufv_status_resumo] ?? UFV_BADGE.SEM_UFV
    : null;
  const finMeta = cliente.status_financeiro_ca
    ? FIN_BADGE[cliente.status_financeiro_ca] ?? FIN_BADGE.OK
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {cliente.empresa}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {origemLabel.replace('_', ' ')}
            </Badge>
            {cliente.solarz_customer_id && (
              <Badge variant="outline">Solarz ID: {cliente.solarz_customer_id}</Badge>
            )}
            {ufvMeta && (
              <Badge variant="outline" className={`flex items-center gap-1 ${ufvMeta.className}`}>
                <ufvMeta.Icon className="h-3 w-3" />
                {ufvMeta.label}
              </Badge>
            )}
            {finMeta && (
              <Badge variant="outline" className={`flex items-center gap-1 ${finMeta.className}`}>
                <finMeta.Icon className="h-3 w-3" />
                {finMeta.label}
                {cliente.status_financeiro_ca === 'INADIMPLENTE' &&
                  cliente.atrasos_recebimentos != null && (
                    <span className="ml-1 font-mono">
                      · {formatBRL(cliente.atrasos_recebimentos)}
                    </span>
                  )}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">Última sincronização: {lastSync}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Identificação (read-only) */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Identificação
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (sincronizado — somente leitura)
              </span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadOnlyField label="Empresa / Nome" value={cliente.empresa} />
              <ReadOnlyField label="CNPJ / CPF" value={formatCpfCnpj(cliente.cnpj_cpf)} />
              <ReadOnlyField label="Endereço principal" value={cliente.endereco} />
              <ReadOnlyField
                label="Cidade / UF / CEP"
                value={[cliente.cidade, cliente.estado, formatCep(cliente.cep)]
                  .filter((v) => v && v !== '—')
                  .join(' · ')}
              />
            </div>
          </section>

          {/* Contatos */}
          {cliente.profile && (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Contato vinculado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{cliente.profile.email}</span>
                </div>
                {cliente.profile.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{formatPhone(cliente.profile.telefone)}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Telefones e endereços unificados */}
          {(cliente.telefones_unificados || cliente.enderecos_unificados) && (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                Dados unificados
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (de Solarz + Conta Azul)
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ReadOnlyField
                  label="Telefones"
                  value={formatPhoneLines(cliente.telefones_unificados)}
                  multiline
                />
                <ReadOnlyField
                  label="Endereços"
                  value={cliente.enderecos_unificados}
                  multiline
                />
              </div>
            </section>
          )}

          {/* UFVs */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sun className="h-4 w-4" />
              UFVs Solarz ({cliente.ufvs.length})
            </h4>
            {cliente.ufvs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma usina vinculada a este cliente no Solarz.
              </p>
            ) : (
              <div className="space-y-2">
                {cliente.ufvs.map((ufv) => {
                  const local = [ufv.cidade, ufv.estado].filter(Boolean).join('/');
                  return (
                    <div
                      key={ufv.id}
                      className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {ufv.nome || `UFV ${ufv.solarz_ufv_id}`}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          {ufv.potencia_kwp != null && (
                            <Badge variant="secondary">
                              {Number(ufv.potencia_kwp).toFixed(2)} kWp
                            </Badge>
                          )}
                          {ufv.status && <Badge variant="outline">{ufv.status}</Badge>}
                        </div>
                      </div>
                      {(ufv.endereco || local || ufv.cep) && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>
                            {[ufv.endereco, local, formatCep(ufv.cep)]
                              .filter((v) => v && v !== '—')
                              .join(' · ')}
                          </span>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        ID Solarz: {ufv.solarz_ufv_id}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Conta Azul */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              IDs Conta Azul ({cliente.conta_azul_ids.length})
              {cliente.status_financeiro_ca === 'INADIMPLENTE' && (
                <Badge variant="outline" className={FIN_BADGE.INADIMPLENTE.className}>
                  Em atraso: {formatBRL(cliente.atrasos_recebimentos)}
                </Badge>
              )}
            </h4>
            {cliente.conta_azul_ids.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum cadastro vinculado no Conta Azul.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cliente.conta_azul_ids.map((ca) => (
                  <div
                    key={ca.id}
                    className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">
                        {ca.nome_fiscal || ca.email || 'Cadastro CA'}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {ca.conta_azul_customer_id}
                      </Badge>
                    </div>
                    {ca.cnpj_cpf && (
                      <p className="text-xs text-muted-foreground">
                        CNPJ/CPF: {formatCpfCnpj(ca.cnpj_cpf)}
                      </p>
                    )}
                    {ca.email && (
                      <p className="text-xs text-muted-foreground truncate">{ca.email}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Editáveis */}
          <Form {...form}>
            <form
              id="cliente-edit-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 rounded-md border border-border/60 bg-background/50 p-4"
            >
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">Configurações internas</h4>
                <span className="text-xs text-muted-foreground">(editáveis)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        Prioridade
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              Escala de 1 a 5. <strong>Quanto menor, mais urgente</strong> — 1 é a
                              prioridade máxima e 5 a mais baixa.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          {...field}
                          value={field.value ?? 5}
                          onChange={(e) => {
                            const v = e.target.value ? parseInt(e.target.value, 10) : 5;
                            field.onChange(Math.min(5, Math.max(1, v)));
                          }}
                          placeholder="1 (urgente) a 5 (baixa)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div /> {/* spacer */}
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={4}
                        placeholder="Anotações operacionais (não são enviadas para Solarz/Conta Azul)"
                      />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">
                      Visível apenas internamente. Sobrescreve o histórico mesclado de duplicatas.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="submit" form="cliente-edit-form" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
