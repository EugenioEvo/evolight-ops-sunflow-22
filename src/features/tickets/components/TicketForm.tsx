import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/FileUpload';
import { AlertTriangle, Clock } from 'lucide-react';
import { ticketSchema, type TicketFormData } from '../types';

interface TicketFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTicket: any;
  clientes: any[];
  prestadores: any[];
  ufvSolarzListForForm: string[];
  loading: boolean;
  onSubmit: (data: TicketFormData, technicianId: string | null, attachments: string[]) => Promise<void>;
  getScoresForTicket?: (ticket?: any) => any[];
}

export const TicketForm = ({
  open,
  onOpenChange,
  editingTicket,
  clientes,
  prestadores,
  ufvSolarzListForForm,
  loading,
  onSubmit,
  getScoresForTicket,
}: TicketFormProps) => {
  const [selectedTechnician, setSelectedTechnician] = useState<string>(editingTicket?.tecnico_responsavel_id || '');
  const [attachments, setAttachments] = useState<string[]>(editingTicket?.anexos || []);
  const [selectedUfvSolarzForm, setSelectedUfvSolarzForm] = useState<string>(editingTicket?.clientes?.ufv_solarz || '');

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: editingTicket ? {
      titulo: editingTicket.titulo,
      descricao: editingTicket.descricao,
      cliente_id: editingTicket.cliente_id,
      equipamento_tipo: editingTicket.equipamento_tipo,
      prioridade: editingTicket.prioridade,
      endereco_servico: editingTicket.endereco_servico,
      data_servico: editingTicket.data_servico || '',
      data_vencimento: editingTicket.data_vencimento ? new Date(editingTicket.data_vencimento).toISOString().split('T')[0] : '',
      horario_previsto_inicio: editingTicket.horario_previsto_inicio || '',
      tempo_estimado: editingTicket.tempo_estimado || undefined,
      observacoes: editingTicket.observacoes || '',
      anexos: editingTicket.anexos || [],
    } : {
      titulo: '',
      descricao: '',
      cliente_id: '',
      equipamento_tipo: 'painel_solar',
      prioridade: 'media',
      endereco_servico: '',
      data_servico: '',
      data_vencimento: '',
      horario_previsto_inicio: '',
      tempo_estimado: undefined,
      observacoes: '',
    },
  });

  const handleSubmit = async (data: TicketFormData) => {
    await onSubmit(data, selectedTechnician || null, attachments);
    onOpenChange(false);
    form.reset();
    setSelectedTechnician('');
    setAttachments([]);
  };

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
            <div className="grid grid-cols-2 gap-4">
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
              
              <FormItem>
                <FormLabel>UFV/SolarZ</FormLabel>
                <Select 
                  value={selectedUfvSolarzForm}
                  onValueChange={(value) => {
                    setSelectedUfvSolarzForm(value);
                    const clienteAssociado = clientes.find((c: any) => c.ufv_solarz === value);
                    if (clienteAssociado) {
                      form.setValue('cliente_id', clienteAssociado.id);
                      const endereco = `${clienteAssociado.endereco || ''}, ${clienteAssociado.cidade || ''}, ${clienteAssociado.estado || ''} - ${clienteAssociado.cep || ''}`.trim().replace(/^,\s*|,\s*$/, '');
                      if (endereco && endereco !== ' -  - ') {
                        form.setValue('endereco_servico', endereco);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione UFV/SolarZ" />
                  </SelectTrigger>
                  <SelectContent>
                    {ufvSolarzListForForm.map((ufv) => (
                      <SelectItem key={ufv} value={ufv}>{ufv}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      const clienteSelecionado = clientes.find((c: any) => c.id === value);
                      if (clienteSelecionado) {
                        const endereco = `${clienteSelecionado.endereco || ''}, ${clienteSelecionado.cidade || ''}, ${clienteSelecionado.estado || ''} - ${clienteSelecionado.cep || ''}`.trim().replace(/^,\s*|,\s*$/, '');
                        if (endereco && endereco !== ' -  - ') {
                          form.setValue('endereco_servico', endereco);
                        }
                        if (clienteSelecionado.ufv_solarz) {
                          setSelectedUfvSolarzForm(clienteSelecionado.ufv_solarz);
                        }
                      }
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientes.map((cliente: any) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.empresa || cliente.profiles?.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Textarea {...field} placeholder="Descreva o problema..." rows={1} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endereco_servico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço do Serviço</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Endereço completo onde o serviço será realizado..." rows={2} />
                  </FormControl>
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
            {form.watch('data_servico') && form.watch('data_vencimento') && new Date(form.watch('data_servico')!) > new Date(form.watch('data_vencimento')!) && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <Clock className="h-4 w-4 shrink-0" />
                <span>A data de serviço está após a data limite de vencimento.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tempo_estimado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempo Estimado (horas)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Ex: 4"
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
