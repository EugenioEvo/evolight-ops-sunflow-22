import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Plus, Search, Settings, FileText, CheckCircle, XCircle } from 'lucide-react';

const ticketSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  cliente_id: z.string().uuid('Selecione um cliente'),
  equipamento_tipo: z.enum(['painel_solar', 'inversor', 'controlador_carga', 'bateria', 'cabeamento', 'estrutura', 'monitoramento', 'outros']),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
  endereco_servico: z.string().min(1, 'Endereço do serviço é obrigatório'),
  data_vencimento: z.string().optional(),
  tempo_estimado: z.number().min(1, 'Tempo estimado deve ser maior que 0').optional(),
  observacoes: z.string().optional(),
});

type TicketForm = z.infer<typeof ticketSchema>;

const Tickets = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { user, profile } = useAuth();
  const { toast } = useToast();

  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      cliente_id: '',
      equipamento_tipo: 'painel_solar',
      prioridade: 'media',
      endereco_servico: '',
      data_vencimento: '',
      tempo_estimado: undefined,
      observacoes: '',
    },
  });

  const [selectedTechnicianForTicket, setSelectedTechnicianForTicket] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar clientes com endereço completo
      const { data: clientesData } = await supabase
        .from('clientes')
        .select(`
          id,
          empresa,
          endereco,
          cidade,
          estado,
          cep,
          cnpj_cpf,
          profiles(nome, email, telefone)
        `);
      setClientes(clientesData || []);

      // Carregar técnicos
      const { data: tecnicosData } = await supabase
        .from('tecnicos')
        .select(`
          id,
          registro_profissional,
          profiles!inner(nome, email)
        `);
      setTecnicos(tecnicosData || []);

      // Carregar tickets (usar left join para incluir clientes sem profile)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          clientes(
            empresa,
            endereco,
            cidade,
            estado,
            cep,
            profiles(nome, email)
          ),
          tecnicos(
            profiles(nome)
          )
        `)
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('Erro ao carregar tickets:', ticketsError);
        throw ticketsError;
      }

      setTickets(ticketsData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSubmit = async (data: TicketForm) => {
    try {
      setLoading(true);

      const ticketData = {
        ...data,
        tempo_estimado: data.tempo_estimado || null,
        data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : null,
        created_by: user?.id,
        tecnico_responsavel_id: selectedTechnicianForTicket || null,
        status: 'aguardando_aprovacao',
      };

      if (editingTicket) {
        const { error } = await supabase
          .from('tickets')
          .update(ticketData as any)
          .eq('id', editingTicket.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Ticket atualizado com sucesso!',
        });
      } else {
        const { error } = await supabase
          .from('tickets')
          .insert([ticketData as any]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Ticket criado aguardando aprovação!',
        });
      }

      setIsDialogOpen(false);
      setEditingTicket(null);
      setSelectedTechnicianForTicket('');
      form.reset();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar ticket:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar ticket',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ticket: any) => {
    setEditingTicket(ticket);
    setSelectedTechnicianForTicket(ticket.tecnico_responsavel_id || '');
    form.reset({
      titulo: ticket.titulo,
      descricao: ticket.descricao,
      cliente_id: ticket.cliente_id,
      equipamento_tipo: ticket.equipamento_tipo,
      prioridade: ticket.prioridade,
      endereco_servico: ticket.endereco_servico,
      data_vencimento: ticket.data_vencimento ? new Date(ticket.data_vencimento).toISOString().split('T')[0] : '',
      tempo_estimado: ticket.tempo_estimado || undefined,
      observacoes: ticket.observacoes || '',
    });
    setIsDialogOpen(true);
  };

  const handleAssignTechnician = async (ticketId: string, technicianId: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ tecnico_responsavel_id: technicianId })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Técnico atribuído com sucesso!',
      });
      loadData();
    } catch (error: any) {
      console.error('Erro ao atribuir técnico:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atribuir técnico',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (ticketId: string) => {
    try {
      setLoading(true);
      
      // Atualizar status do ticket
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'aprovado' })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Registrar aprovação
      const { error: approvalError } = await supabase
        .from('aprovacoes')
        .insert({
          ticket_id: ticketId,
          aprovador_id: profile?.id,
          status: 'aprovado',
          observacoes: 'Aprovado automaticamente'
        });

      if (approvalError) throw approvalError;

      toast({
        title: 'Sucesso',
        description: 'Ticket aprovado com sucesso!',
      });

      loadData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao aprovar ticket',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (ticketId: string) => {
    try {
      setLoading(true);
      
      // Atualizar status do ticket
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'rejeitado' })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Registrar rejeição
      const { error: approvalError } = await supabase
        .from('aprovacoes')
        .insert({
          ticket_id: ticketId,
          aprovador_id: profile?.id,
          status: 'rejeitado',
          observacoes: 'Rejeitado'
        });

      if (approvalError) throw approvalError;

      toast({
        title: 'Sucesso',
        description: 'Ticket rejeitado',
      });

      loadData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao rejeitar ticket',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOS = async (ticketId: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('gerar-ordem-servico', {
        body: { ticketId }
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Ordem de serviço gerada com sucesso!',
      });

      // Abrir PDF em nova aba
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      }

      loadData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao gerar ordem de serviço',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const clienteNome = ticket.clientes?.empresa || ticket.clientes?.profiles?.nome || '';
    const matchesSearch = ticket.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.numero_ticket.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         clienteNome.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'todos') return matchesSearch;
    return matchesSearch && ticket.status === activeTab;
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'aberto': 'bg-blue-100 text-blue-800',
      'aguardando_aprovacao': 'bg-yellow-100 text-yellow-800',
      'aprovado': 'bg-green-100 text-green-800',
      'rejeitado': 'bg-red-100 text-red-800',
      'ordem_servico_gerada': 'bg-purple-100 text-purple-800',
      'em_execucao': 'bg-orange-100 text-orange-800',
      'aguardando_rme': 'bg-indigo-100 text-indigo-800',
      'concluido': 'bg-gray-100 text-gray-800',
      'cancelado': 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors = {
      'baixa': 'bg-green-100 text-green-800',
      'media': 'bg-yellow-100 text-yellow-800',
      'alta': 'bg-orange-100 text-orange-800',
      'critica': 'bg-red-100 text-red-800'
    };
    return colors[prioridade as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getEquipamentoIcon = (tipo: string) => {
    return <Settings className="h-4 w-4" />;
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">Gerencie solicitações de manutenção</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingTicket(null); form.reset(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTicket ? 'Editar Ticket' : 'Criar Novo Ticket'}</DialogTitle>
              <DialogDescription>
                {editingTicket ? 'Atualize os dados do ticket' : 'Preencha os dados para criar um novo ticket'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <FormField
                    control={form.control}
                    name="cliente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          // Auto-preencher endereço baseado no cliente selecionado
                          const clienteSelecionado = clientes.find(c => c.id === value);
                          if (clienteSelecionado) {
                            const endereco = `${clienteSelecionado.endereco || ''}, ${clienteSelecionado.cidade || ''}, ${clienteSelecionado.estado || ''} - ${clienteSelecionado.cep || ''}`.trim().replace(/^,\s*|,\s*$/, '');
                            form.setValue('endereco_servico', endereco);
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map((cliente) => (
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
                </div>

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descreva o problema ou serviço necessário..." rows={3} />
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
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
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
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
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
                    name="data_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Vencimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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

                {(profile?.role === 'admin' || profile?.role === 'area_tecnica') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Técnico Responsável</label>
                    <Select value={selectedTechnicianForTicket} onValueChange={setSelectedTechnicianForTicket}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um técnico (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {tecnicos.map((tecnico) => (
                          <SelectItem key={tecnico.id} value={tecnico.id}>
                            {tecnico.profiles?.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="aberto">Abertos</TabsTrigger>
          <TabsTrigger value="aguardando_aprovacao">Aguardando Aprovação</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="em_execucao">Em Execução</TabsTrigger>
          <TabsTrigger value="concluido">Concluídos</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Nenhum ticket encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Tente ajustar os filtros de busca' : 'Crie seu primeiro ticket'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTickets.map((ticket) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{ticket.titulo}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {ticket.numero_ticket}
                          </Badge>
                        </div>
                        <CardDescription>
                          Cliente: {ticket.clientes?.empresa || ticket.clientes?.profiles?.nome}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge className={getPrioridadeColor(ticket.prioridade)}>
                          {ticket.prioridade.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">{ticket.descricao}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          {getEquipamentoIcon(ticket.equipamento_tipo)}
                          <span>{ticket.equipamento_tipo.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{ticket.endereco_servico}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(ticket.data_abertura).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {ticket.tempo_estimado && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>{ticket.tempo_estimado} horas estimadas</span>
                        </div>
                      )}

                      {(profile?.role === 'admin' || profile?.role === 'area_tecnica') && !ticket.tecnico_responsavel_id && (
                        <div className="flex items-center gap-2 pt-2">
                          <Select onValueChange={(value) => handleAssignTechnician(ticket.id, value)}>
                            <SelectTrigger className="h-8 w-[200px]">
                              <SelectValue placeholder="Atribuir técnico" />
                            </SelectTrigger>
                            <SelectContent>
                              {tecnicos.map((tecnico) => (
                                <SelectItem key={tecnico.id} value={tecnico.id}>
                                  {tecnico.profiles?.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {ticket.tecnico_responsavel_id && ticket.tecnicos && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Técnico:</strong> {ticket.tecnicos.profiles?.nome}
                        </p>
                      )}

                      {profile?.role === 'area_tecnica' && ticket.status === 'aguardando_aprovacao' && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(ticket.id)}
                            disabled={loading}
                            className="flex items-center gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(ticket.id)}
                            disabled={loading}
                            className="flex items-center gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Rejeitar
                          </Button>
                        </div>
                      )}

                      {profile?.role === 'area_tecnica' && ticket.status === 'aprovado' && ticket.tecnico_responsavel_id && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            onClick={() => handleGenerateOS(ticket.id)}
                            disabled={loading}
                            className="flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            Gerar Ordem de Serviço
                          </Button>
                        </div>
                      )}

                      {profile?.role === 'area_tecnica' && ticket.status === 'aprovado' && !ticket.tecnico_responsavel_id && (
                        <Badge variant="secondary" className="mt-2">Atribua um técnico primeiro</Badge>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          Criado em {new Date(ticket.created_at).toLocaleString('pt-BR')}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(ticket)}>
                          Editar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tickets;