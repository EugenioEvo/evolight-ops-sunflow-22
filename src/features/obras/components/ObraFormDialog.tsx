import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { obraSchema, OBRA_STATUS, OBRA_STATUS_LABEL, type Obra, type ObraForm } from '../types';
import { ESTADOS_BR } from '@/features/clients/types';
import { useClientesQuery, usePrestadoresQuery } from '@/shared/hooks';
import { useObraMutations } from '../hooks/useObras';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: Obra | null;
}

const NONE = '__none__';

export function ObraFormDialog({ open, onOpenChange, obra }: Props) {
  const { data: clientes = [] } = useClientesQuery(500);
  const { data: prestadores = [] } = usePrestadoresQuery();
  const { create, update } = useObraMutations();

  const form = useForm<ObraForm>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      nome: '',
      cliente_id: null,
      responsavel_obra_id: null,
      endereco: '', cidade: '', estado: '', cep: '',
      data_inicio_prevista: '', data_fim_prevista: '',
      data_inicio_real: '', data_fim_real: '',
      potencia_kwp: null,
      status: 'planejada',
      observacoes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(obra ? {
        nome: obra.nome,
        cliente_id: obra.cliente_id,
        responsavel_obra_id: obra.responsavel_obra_id,
        endereco: obra.endereco ?? '', cidade: obra.cidade ?? '', estado: obra.estado ?? '', cep: obra.cep ?? '',
        data_inicio_prevista: obra.data_inicio_prevista ?? '', data_fim_prevista: obra.data_fim_prevista ?? '',
        data_inicio_real: obra.data_inicio_real ?? '', data_fim_real: obra.data_fim_real ?? '',
        potencia_kwp: obra.potencia_kwp,
        status: obra.status,
        observacoes: obra.observacoes ?? '',
      } : {
        nome: '', cliente_id: null, responsavel_obra_id: null,
        endereco: '', cidade: '', estado: '', cep: '',
        data_inicio_prevista: '', data_fim_prevista: '',
        data_inicio_real: '', data_fim_real: '',
        potencia_kwp: null, status: 'planejada', observacoes: '',
      });
    }
  }, [open, obra, form]);

  const onSubmit = async (values: ObraForm) => {
    if (obra) {
      await update.mutateAsync({ id: obra.id, payload: values });
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  };

  const supervisores = prestadores.filter((p: any) => p.ativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obra ? 'Editar obra' : 'Nova obra'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="nome" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da obra *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField name="cliente_id" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem cliente (obra própria)</SelectItem>
                      {clientes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.empresa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="responsavel_obra_id" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável (Sup. Eletromecânico)</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem responsável</SelectItem>
                      {supervisores.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField name="endereco" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField name="cidade" control={form.control} render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Cidade</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField name="estado" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>UF</FormLabel>
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {ESTADOS_BR.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField name="cep" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField name="data_inicio_prevista" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Início previsto</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField name="data_fim_prevista" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Fim previsto</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField name="data_inicio_real" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Início real</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField name="data_fim_real" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Fim real</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField name="potencia_kwp" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Potência (kWp)</FormLabel>
                  <FormControl>
                    <Input
                      type="number" step="0.01" min="0"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="status" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {OBRA_STATUS.map((s) => <SelectItem key={s} value={s}>{OBRA_STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField name="observacoes" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {obra ? 'Salvar' : 'Criar obra'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
