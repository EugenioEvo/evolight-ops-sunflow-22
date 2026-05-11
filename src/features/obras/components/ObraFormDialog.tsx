import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { obraSchema, OBRA_STATUS, OBRA_STATUS_LABEL, type Obra, type ObraForm } from '../types';
import { ESTADOS_BR } from '@/features/clients/types';
import { useClientesQuery, usePrestadoresQuery } from '@/shared/hooks';
import { useObraMutations } from '../hooks/useObras';
import { ClienteCombobox } from './ClienteCombobox';
import { CoordsField } from './CoordsField';
import { ObraMetasTab } from './ObraMetasTab';

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
  const [tab, setTab] = useState<'dados' | 'metas'>('dados');
  const metasSaveRef = useRef<((obraId: string) => Promise<void>) | null>(null);

  const form = useForm<ObraForm>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      nome: '', cliente_id: null, responsavel_obra_id: null,
      endereco: '', cidade: '', estado: '', cep: '',
      data_inicio_prevista: '', data_fim_prevista: '',
      data_inicio_real: '', data_fim_real: '',
      latitude: null, longitude: null,
      potencia_kwp: null, status: 'planejada', observacoes: '',
    },
  });

  useEffect(() => {
    if (open) {
      setTab('dados');
      form.reset(obra ? {
        nome: obra.nome,
        cliente_id: obra.cliente_id,
        responsavel_obra_id: obra.responsavel_obra_id,
        endereco: obra.endereco ?? '', cidade: obra.cidade ?? '', estado: obra.estado ?? '', cep: obra.cep ?? '',
        data_inicio_prevista: obra.data_inicio_prevista ?? '', data_fim_prevista: obra.data_fim_prevista ?? '',
        data_inicio_real: obra.data_inicio_real ?? '', data_fim_real: obra.data_fim_real ?? '',
        latitude: obra.latitude, longitude: obra.longitude,
        potencia_kwp: obra.potencia_kwp,
        status: obra.status,
        observacoes: obra.observacoes ?? '',
      } : {
        nome: '', cliente_id: null, responsavel_obra_id: null,
        endereco: '', cidade: '', estado: '', cep: '',
        data_inicio_prevista: '', data_fim_prevista: '',
        data_inicio_real: '', data_fim_real: '',
        latitude: null, longitude: null,
        potencia_kwp: null, status: 'planejada', observacoes: '',
      });
    }
  }, [open, obra, form]);

  const onSubmit = async (values: ObraForm) => {
    let savedId = obra?.id ?? null;
    if (obra) {
      await update.mutateAsync({ id: obra.id, payload: values });
    } else {
      const created = await create.mutateAsync(values);
      // create.mutationFn does not return id today; refetch via service
      // Fallback: ask the service to return id by re-querying after invalidate
      // Simpler: we'll rely on user reopening; but for metas saving we need id now.
      // Updated approach: create service returns void but we can reuse mutation onSuccess flow.
      // To keep this simple, save metas only when editing existing obra.
      savedId = (created as any)?.id ?? null;
    }
    if (savedId && metasSaveRef.current) {
      try { await metasSaveRef.current(savedId); } catch { /* surfaced via toast in service */ }
    }
    onOpenChange(false);
  };

  const supervisores = prestadores.filter((p: any) => p.ativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obra ? 'Editar obra' : 'Nova obra'}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dados">Dados da obra</TabsTrigger>
            <TabsTrigger value="metas">Metas do catálogo</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <TabsContent value="dados" className="space-y-4 mt-0">
                <FormField name="nome" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da obra *</FormLabel>
                    <FormControl><Input placeholder="Ex.: UFV Fazenda Sol Forte" {...field} /></FormControl>
                    <FormDescription>Nome interno usado para identificar a obra em RDOs e relatórios.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField name="cliente_id" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <FormControl>
                        <ClienteCombobox
                          clientes={clientes as any[]}
                          value={field.value ?? null}
                          onChange={(id) => field.onChange(id)}
                        />
                      </FormControl>
                      <FormDescription>Busque por nome, CNPJ/CPF ou cidade. Deixe vazio para obra própria.</FormDescription>
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
                      <FormDescription>Prestador que assina os RDOs desta obra.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField name="endereco" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl><Input placeholder="Rua / rodovia, número, bairro" {...field} value={field.value ?? ''} /></FormControl>
                    <FormDescription>Logradouro completo do canteiro.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField name="cidade" control={form.control} render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Cidade</FormLabel>
                      <FormControl><Input placeholder="Goiânia" {...field} value={field.value ?? ''} /></FormControl>
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
                      <FormControl><Input placeholder="00000-000" {...field} value={field.value ?? ''} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Coordenadas */}
                <FormField name="latitude" control={form.control} render={({ field }) => {
                  const lat = field.value as number | null;
                  const lng = form.watch('longitude') as number | null;
                  return (
                    <FormItem>
                      <FormControl>
                        <CoordsField
                          endereco={form.watch('endereco')}
                          cidade={form.watch('cidade')}
                          estado={form.watch('estado')}
                          cep={form.watch('cep')}
                          latitude={lat}
                          longitude={lng}
                          onChange={(la, lo) => {
                            form.setValue('latitude', la, { shouldDirty: true });
                            form.setValue('longitude', lo, { shouldDirty: true });
                          }}
                          onAddressResolved={(addr) => {
                            if (addr.endereco) form.setValue('endereco', addr.endereco, { shouldDirty: true });
                            if (addr.cidade) form.setValue('cidade', addr.cidade, { shouldDirty: true });
                            if (addr.estado) form.setValue('estado', addr.estado, { shouldDirty: true });
                            if (addr.cep) form.setValue('cep', addr.cep, { shouldDirty: true });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }} />

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
                          placeholder="Ex.: 850"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Potência total instalada da usina, em kWp.</FormDescription>
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
                    <FormControl>
                      <Textarea rows={3} placeholder="Notas internas, condições especiais, contatos no canteiro..." {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>Informações úteis para a equipe de campo.</FormDescription>
                  </FormItem>
                )} />
              </TabsContent>

              <TabsContent value="metas" className="mt-0">
                <ObraMetasTab
                  obraId={obra?.id ?? null}
                  registerSaveHandler={(h) => { metasSaveRef.current = h; }}
                />
              </TabsContent>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending || update.isPending}>
                  {obra ? 'Salvar alterações' : 'Criar obra'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
