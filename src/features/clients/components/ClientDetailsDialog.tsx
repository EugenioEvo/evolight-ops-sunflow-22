import { Lock, Sun, Database, MapPin, Phone, Mail, Building2 } from 'lucide-react';
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
import type { UseFormReturn } from 'react-hook-form';
import type { Cliente, ClienteEditableForm } from '../types';

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
              <ReadOnlyField label="CNPJ / CPF" value={cliente.cnpj_cpf} />
              <ReadOnlyField label="Endereço principal" value={cliente.endereco} />
              <ReadOnlyField
                label="Cidade / UF / CEP"
                value={[cliente.cidade, cliente.estado, cliente.cep].filter(Boolean).join(' · ')}
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
                    <span>{cliente.profile.telefone}</span>
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
                  value={cliente.telefones_unificados}
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
                            <Badge variant="secondary">{Number(ufv.potencia_kwp).toFixed(2)} kWp</Badge>
                          )}
                          {ufv.status && <Badge variant="outline">{ufv.status}</Badge>}
                        </div>
                      </div>
                      {(ufv.endereco || local || ufv.cep) && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>
                            {[ufv.endereco, local, ufv.cep].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">ID Solarz: {ufv.solarz_ufv_id}</p>
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
                      <p className="text-xs text-muted-foreground">CNPJ/CPF: {ca.cnpj_cpf}</p>
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
                <h4 className="text-sm font-semibold text-foreground">Configurações Lovable</h4>
                <span className="text-xs text-muted-foreground">(editáveis)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={field.value ?? 5}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseInt(e.target.value, 10) : 5)
                          }
                          placeholder="Quanto menor, mais prioritário"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ufv_solarz"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UFV/SolarZ (apelido interno)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Identificador interno do projeto"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        rows={3}
                        placeholder="Anotações operacionais (não são enviadas para Solarz/Conta Azul)"
                        disabled
                      />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">
                      Campo reservado — em breve poderá ser editado.
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