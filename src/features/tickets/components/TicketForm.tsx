import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/FileUpload';
import { Clock, AlertTriangle, ChevronsUpDown, Check, CircleDollarSign, Sun, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ticketSchema, type TicketFormData, type TicketWithRelations, type TicketCliente, type TicketPrestador } from '../types';
import { useSimilarTickets } from '../hooks/useSimilarTickets';

interface TicketFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTicket: TicketWithRelations | null;
  clientes: TicketCliente[];
  prestadores: TicketPrestador[];
  ufvSolarzListForForm: string[];
  loading: boolean;
  onSubmit: (data: TicketFormData, technicianId: string | null, attachments: string[]) => Promise<void>;
  getScoresForTicket?: (ticket?: TicketWithRelations) => Array<{ id: string; score: number }>;
}

const SEM_USINA_VALUE = '__sem_usina__';

const isInadimplente = (status: string | null | undefined) =>
  !!status && status.toUpperCase() !== 'OK';

const formatBRL = (value: number | null | undefined) => {
  if (!value || value <= 0) return null;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const buildEnderecoFromUFV = (ufv: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null }) => {
  const parts = [ufv.endereco, ufv.cidade, ufv.estado].filter(Boolean).join(', ');
  const withCep = ufv.cep ? `${parts} - ${ufv.cep}` : parts;
  return withCep.trim();
};

const buildEnderecoFromCliente = (c: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null }) => {
  const parts = [c.endereco, c.cidade, c.estado].filter(Boolean).join(', ');
  const withCep = c.cep ? `${parts} - ${c.cep}` : parts;
  return withCep.trim();
};

export const TicketForm = ({
  open,
  onOpenChange,
  editingTicket,
  clientes,
  loading,
  onSubmit,
}: TicketFormProps) => {
  const [selectedTechnician] = useState<string>(editingTicket?.tecnico_responsavel_id || '');
  const [attachments, setAttachments] = useState<string[]>(editingTicket?.anexos || []);
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: editingTicket ? {
      titulo: editingTicket.titulo,
      descricao: editingTicket.descricao,
      cliente_id: editingTicket.cliente_id,
      ufv_nome: editingTicket.ufv_nome || '',
      equipamento_tipo: editingTicket.equipamento_tipo as TicketFormData['equipamento_tipo'],
      prioridade: editingTicket.prioridade as TicketFormData['prioridade'],
      endereco_servico: editingTicket.endereco_servico,
      data_servico: editingTicket.data_servico || '',
      data_vencimento: editingTicket.data_vencimento ? new Date(editingTicket.data_vencimento).toISOString().split('T')[0] : '',
      horario_previsto_inicio: editingTicket.horario_previsto_inicio || '',
      observacoes: editingTicket.observacoes || '',
      anexos: editingTicket.anexos || [],
    } : {
      titulo: '',
      descricao: '',
      cliente_id: '',
      ufv_nome: '',
      equipamento_tipo: 'painel_solar',
      prioridade: 'media',
      endereco_servico: '',
      data_servico: '',
      data_vencimento: '',
      horario_previsto_inicio: '',
      observacoes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingTicket) {
      form.reset({
        titulo: editingTicket.titulo,
        descricao: editingTicket.descricao,
        cliente_id: editingTicket.cliente_id,
        ufv_nome: editingTicket.ufv_nome || '',
        equipamento_tipo: editingTicket.equipamento_tipo as TicketFormData['equipamento_tipo'],
        prioridade: editingTicket.prioridade as TicketFormData['prioridade'],
        endereco_servico: editingTicket.endereco_servico,
        data_servico: editingTicket.data_servico || '',
        data_vencimento: editingTicket.data_vencimento ? new Date(editingTicket.data_vencimento).toISOString().split('T')[0] : '',
        horario_previsto_inicio: editingTicket.horario_previsto_inicio || '',
        observacoes: editingTicket.observacoes || '',
        anexos: editingTicket.anexos || [],
      });
      setAttachments(editingTicket.anexos || []);
    } else {
      form.reset({
        titulo: '',
        descricao: '',
        cliente_id: '',
        ufv_nome: '',
        equipamento_tipo: 'painel_solar',
        prioridade: 'media',
        endereco_servico: '',
        data_servico: '',
        data_vencimento: '',
        horario_previsto_inicio: '',
        observacoes: '',
      });
      setAttachments([]);
    }
  }, [editingTicket, open, form]);

  const watchedClienteId = form.watch('cliente_id');
  const watchedUfvNome = form.watch('ufv_nome');
  const watchedEquipamentoTipo = form.watch('equipamento_tipo');

  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === watchedClienteId),
    [clientes, watchedClienteId]
  );

  const clientesOrdenados = useMemo(
    () =>
      [...clientes].sort((a, b) => {
        const an = (a.empresa || a.profiles?.nome || '').toLowerCase();
        const bn = (b.empresa || b.profiles?.nome || '').toLowerCase();
        return an.localeCompare(bn);
      }),
    [clientes]
  );

  const { similar: similarTickets } = useSimilarTickets({
    clienteId: watchedClienteId,
    equipamentoTipo: watchedEquipamentoTipo,
    excludeId: editingTicket?.id,
    enabled: open,
  });

  const handleSelectCliente = (clienteId: string) => {
    const c = clientes.find((cli) => cli.id === clienteId);
    form.setValue('cliente_id', clienteId, { shouldValidate: true });
    setClientePopoverOpen(false);
    if (!c) return;

    // Auto-select UFV when cliente has exactly one; otherwise clear so user picks
    if (c.ufvs.length === 1) {
      const ufv = c.ufvs[0];
      form.setValue('ufv_nome', ufv.nome);
      const enderecoUfv = buildEnderecoFromUFV(ufv);
      if (enderecoUfv) form.setValue('endereco_servico', enderecoUfv);
      else {
        const enderecoCli = buildEnderecoFromCliente(c);
        if (enderecoCli) form.setValue('endereco_servico', enderecoCli);
      }
    } else {
      form.setValue('ufv_nome', '');
      const enderecoCli = buildEnderecoFromCliente(c);
      if (enderecoCli) form.setValue('endereco_servico', enderecoCli);
    }
  };

  const handleSelectUFV = (value: string) => {
    if (value === SEM_USINA_VALUE) {
      form.setValue('ufv_nome', '');
      return;
    }
    form.setValue('ufv_nome', value);
    const ufv = selectedCliente?.ufvs.find((u) => u.nome === value);
    if (ufv) {
      const enderecoUfv = buildEnderecoFromUFV(ufv);
      if (enderecoUfv) form.setValue('endereco_servico', enderecoUfv);
    }
  };

  const handleSubmit = async (data: TicketFormData) => {
    await onSubmit(data, selectedTechnician || null, attachments);
    onOpenChange(false);
    form.reset();
    setAttachments([]);
  };

  const clienteHasUFVs = (selectedCliente?.ufvs.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTicket ? 'Editar Ticket' : 'Criar Novo Ticket'}</DialogTitle>
          <DialogDescription>
            {editingTicket ? 'Atualize os dados do ticket' : 'Preencha os dados para criar um novo ticket'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Manutenção em painel solar" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cliente — combobox com busca e infos do Conta Azul */}
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Cliente</FormLabel>
                  <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {selectedCliente ? (
                            <span className="flex items-center gap-2 truncate">
                              <span className="truncate">
                                {selectedCliente.empresa || selectedCliente.profiles?.nome}
                              </span>
                              {isInadimplente(selectedCliente.status_financeiro_ca) && (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">
                                  <CircleDollarSign className="h-3 w-3 mr-0.5" />
                                  Inadimplente
                                </Badge>
                              )}
                            </span>
                          ) : (
                            'Buscar cliente por nome ou CNPJ/CPF...'
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[640px]" align="start">
                      <Command
                        filter={(value, search) => {
                          // Custom filter: search across nome + cnpj
                          const c = clientes.find((cli) => cli.id === value);
                          if (!c) return 0;
                          const haystack = [
                            c.empresa,
                            c.profiles?.nome,
                            c.cnpj_cpf,
                          ]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase();
                          return haystack.includes(search.toLowerCase()) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Buscar por nome ou CNPJ/CPF..." />
                        <CommandList className="max-h-72">
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {clientesOrdenados.map((c) => {
                              const nome = c.empresa || c.profiles?.nome || 'Sem nome';
                              const inadimplente = isInadimplente(c.status_financeiro_ca);
                              const atrasos = formatBRL(c.atrasos_recebimentos);
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={c.id}
                                  onSelect={() => handleSelectCliente(c.id)}
                                  className="flex flex-col items-start gap-1 py-2"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <Check
                                      className={cn(
                                        'h-4 w-4 shrink-0',
                                        field.value === c.id ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    <span className="font-medium truncate">{nome}</span>
                                    <span className="ml-auto flex items-center gap-1">
                                      {inadimplente ? (
                                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">
                                          <CircleDollarSign className="h-3 w-3 mr-0.5" />
                                          {atrasos ?? 'Inadimplente'}
                                        </Badge>
                                      ) : c.status_financeiro_ca ? (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                                          OK
                                        </Badge>
                                      ) : null}
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        <Sun className="h-3 w-3 mr-0.5" />
                                        {c.ufvs.length} {c.ufvs.length === 1 ? 'UFV' : 'UFVs'}
                                      </Badge>
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground pl-6 truncate w-full">
                                    {c.cnpj_cpf || 'Sem CNPJ/CPF'}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedCliente && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                      {selectedCliente.cnpj_cpf && <span>{selectedCliente.cnpj_cpf}</span>}
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Sun className="h-3 w-3" />
                        {selectedCliente.ufvs.length} {selectedCliente.ufvs.length === 1 ? 'UFV cadastrada' : 'UFVs cadastradas'}
                      </span>
                      {isInadimplente(selectedCliente.status_financeiro_ca) && formatBRL(selectedCliente.atrasos_recebimentos) && (
                        <>
                          <span>·</span>
                          <span className="text-destructive font-medium">
                            Atrasos: {formatBRL(selectedCliente.atrasos_recebimentos)}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Usina — depende do cliente. Permite digitar valor manual */}
            <FormField
              control={form.control}
              name="ufv_nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usina</FormLabel>
                  {!clienteHasUFVs ? (
                    <>
                      <FormControl>
                        <div className="relative">
                          <Sun className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder={selectedCliente ? 'Digite o nome da usina (opcional)' : 'Selecione um cliente primeiro'}
                            disabled={!selectedCliente}
                            className="pl-8"
                          />
                        </div>
                      </FormControl>
                      {selectedCliente && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Sem usina no SolarZ — você pode digitar um nome livremente.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Select
                        value={field.value || SEM_USINA_VALUE}
                        onValueChange={handleSelectUFV}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a usina" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedCliente!.ufvs.map((ufv) => (
                            <SelectItem key={ufv.id} value={ufv.nome}>
                              <span className="flex items-center gap-2">
                                <Sun className="h-3 w-3" />
                                {ufv.nome}
                              </span>
                            </SelectItem>
                          ))}
                          <SelectItem value={SEM_USINA_VALUE}>
                            <span className="text-muted-foreground italic">— Sem usina —</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Cada ticket aceita apenas 1 usina, mesmo que o cliente tenha mais de uma.
                      </p>
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Descreva o problema..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endereco_servico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço do Serviço</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Endereço completo onde o serviço será realizado..." rows={2} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Pré-preenchido a partir do cadastro do cliente/usina. Edite se precisar.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="equipamento_tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Equipamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="painel_solar">Painel Solar</SelectItem>
                        <SelectItem value="inversor">Inversor</SelectItem>
                        <SelectItem value="controlador_carga">Controlador de Carga</SelectItem>
                        <SelectItem value="bateria">Bateria</SelectItem>
                        <SelectItem value="cabeamento">Cabeamento</SelectItem>
                        <SelectItem value="estrutura">Estrutura</SelectItem>
                        <SelectItem value="monitoramento">Sistema de Monitoramento</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {similarTickets.length > 0 && (
              <div className="flex gap-3 p-3 rounded-md border border-warning/40 bg-warning/10 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-warning">
                    Possível ticket duplicado
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Foram encontrados {similarTickets.length} ticket(s) ativo(s) para este cliente e tipo de equipamento nas últimas 24h:
                  </p>
                  <ul className="text-xs space-y-0.5 mt-1">
                    {similarTickets.map((t) => (
                      <li key={t.id} className="text-foreground">
                        <span className="font-mono">{t.numero_ticket}</span> — {t.titulo}
                        <span className="text-muted-foreground"> ({t.status.replace(/_/g, ' ')})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground italic mt-1">
                    Você pode prosseguir se for um chamado distinto.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="data_servico"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Serviço</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Limite (Vencimento)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="horario_previsto_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário Previsto</FormLabel>
                    <FormControl><Input type="time" {...field} placeholder="08:00" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {form.watch('horario_previsto_inicio') && (() => {
              const t = form.watch('horario_previsto_inicio')!;
              const [h, m] = t.split(':').map(Number);
              const mins = (h || 0) * 60 + (m || 0);
              const inWindow = (mins >= 540 && mins < 720) || (mins >= 840 && mins < 1020);
              if (inWindow) return null;
              return (
                <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Horário fora da janela útil (09:00–12:00 / 14:00–17:00). A OS será reprogramada automaticamente para o próximo slot válido.</span>
                </div>
              );
            })()}

            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Horas previstas:</strong> agora são informadas por técnico no momento da geração da Ordem de Serviço (BI de Carga de Trabalho).
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Informações adicionais..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="anexos"
              render={() => (
                <FormItem>
                  <FormLabel>Anexos</FormLabel>
                  <FormControl>
                    <FileUpload
                      ticketId={editingTicket?.id || 'temp-' + Date.now()}
                      existingFiles={attachments}
                      onFilesChange={setAttachments}
                      maxFiles={5}
                      maxSizeMB={10}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : editingTicket ? 'Atualizar' : 'Criar Ticket'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
