import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, User, MapPin, X, Mail, CheckCircle, Send } from 'lucide-react';
import { ScheduleModal } from '@/components/ScheduleModal';
import { useTicketsRealtime } from '@/hooks/useTicketsRealtime';
import { useCancelOS } from '@/hooks/useCancelOS';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface OrdemServico {
  id: string;
  numero_os: string;
  data_programada: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_estimada_min: number | null;
  tecnico_id: string;
  calendar_invite_sent_at: string | null;
  calendar_invite_recipients: string[] | null;
  tecnicos: {
    id: string;
    profiles: {
      nome: string;
    };
  } | null;
  tickets: {
    numero_ticket: string;
    titulo: string;
    endereco_servico: string;
    status: string;
    prioridade: string;
    clientes: {
      empresa: string;
    };
  };
}

interface Tecnico {
  id: string;
  nome: string;
}

const Agenda = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTecnico, setSelectedTecnico] = useState<string>('todos');
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OrdemServico | null>(null);
  
  useTicketsRealtime();
  const { cancelOS, loading: cancelLoading } = useCancelOS();
  const { toast } = useToast();
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  useEffect(() => {
    loadTecnicos();
  }, []);

  useEffect(() => {
    loadOrdensServico();
  }, [selectedDate, selectedTecnico]);

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('prestadores')
      .select('id, nome')
      .eq('categoria', 'tecnico')
      .order('nome');
    
    if (data) setTecnicos(data as any);
  };

  const loadOrdensServico = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);

      let query = supabase
        .from('ordens_servico')
        .select(`
          *,
          tecnicos!tecnico_id(
            id,
            profiles!inner(nome)
          ),
          tickets!inner(
            numero_ticket,
            titulo,
            endereco_servico,
            status,
            prioridade,
            clientes!inner(empresa)
          )
        `)
        .gte('data_programada', start.toISOString())
        .lte('data_programada', end.toISOString())
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (selectedTecnico !== 'todos') {
        query = query.eq('tecnico_id', selectedTecnico);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrdensServico(data || []);
    } catch (error) {
      console.error('Erro ao carregar agenda:', error);
    } finally {
      setLoading(false);
    }
  };

  const osDoDia = ordensServico.filter(os => 
    isSameDay(new Date(os.data_programada), selectedDate)
  );

  const diasComOS = ordensServico.reduce((acc, os) => {
    const dia = new Date(os.data_programada).getDate();
    acc[dia] = (acc[dia] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      aberto: 'bg-blue-100 text-blue-800',
      em_analise: 'bg-yellow-100 text-yellow-800',
      aprovado: 'bg-green-100 text-green-800',
      em_execucao: 'bg-purple-100 text-purple-800',
      concluido: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      baixa: 'bg-blue-100 text-blue-800',
      media: 'bg-yellow-100 text-yellow-800',
      alta: 'bg-orange-100 text-orange-800',
      urgente: 'bg-red-100 text-red-800',
    };
    return colors[prioridade] || 'bg-gray-100 text-gray-800';
  };

  const resendCalendarInvite = async (osId: string, numeroOS: string) => {
    setResendingInvite(osId);
    try {
      const { error } = await supabase.functions.invoke('send-calendar-invite', {
        body: {
          os_id: osId,
          action: 'create'
        }
      });

      if (error) throw error;

      toast({
        title: 'Convite reenviado',
        description: `Convite de calendário reenviado para OS ${numeroOS}`
      });

      // Recarregar dados para atualizar timestamp
      loadOrdensServico();
    } catch (error: any) {
      console.error('Erro ao reenviar convite:', error);
      toast({
        title: 'Erro ao reenviar',
        description: error.message || 'Não foi possível reenviar o convite',
        variant: 'destructive'
      });
    } finally {
      setResendingInvite(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agenda de Serviços</h1>
        <p className="text-muted-foreground">Gerencie agendamentos e visualize a carga de trabalho</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendário
              </CardTitle>
              <CardDescription>Selecione uma data para ver os agendamentos</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="rounded-md border"
                modifiers={{
                  hasOS: (date) => diasComOS[date.getDate()] > 0
                }}
                modifiersClassNames={{
                  hasOS: 'bg-primary/10 font-bold'
                }}
              />

              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Filtrar por Técnico</label>
                <Select value={selectedTecnico} onValueChange={setSelectedTecnico}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Técnicos</SelectItem>
                    {tecnicos.map(tec => (
                      <SelectItem key={tec.id} value={tec.id}>
                        {tec.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Agendamentos de {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {osDoDia.length === 0 
                  ? 'Nenhum agendamento para este dia' 
                  : `${osDoDia.length} agendamento(s) encontrado(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando agendamentos...
                </div>
              ) : osDoDia.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma OS agendada para este dia
                </div>
              ) : (
                <div className="space-y-4">
                  {osDoDia.map(os => (
                    <Card key={os.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{os.numero_os}</h3>
                              {os.calendar_invite_sent_at && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
                                        <CheckCircle className="h-3 w-3" />
                                        Convite Enviado
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <div className="space-y-1">
                                        <p className="font-semibold">Convite de Calendário</p>
                                        <p className="text-xs">
                                          Enviado em: {format(new Date(os.calendar_invite_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                        {os.calendar_invite_recipients && os.calendar_invite_recipients.length > 0 && (
                                          <div className="text-xs">
                                            <p className="font-medium mt-1">Destinatários:</p>
                                            <ul className="list-disc list-inside">
                                              {os.calendar_invite_recipients.map((email, idx) => (
                                                <li key={idx}>{email}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{os.tickets.titulo}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getPrioridadeColor(os.tickets.prioridade)}>
                              {os.tickets.prioridade}
                            </Badge>
                            <Badge className={getStatusColor(os.tickets.status)}>
                              {os.tickets.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {os.hora_inicio && os.hora_fim 
                              ? `${os.hora_inicio} - ${os.hora_fim}`
                              : 'Horário não definido'}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            {os.tecnicos?.profiles?.nome || 'Não atribuído'}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                            <MapPin className="h-4 w-4" />
                            {os.tickets.endereco_servico}
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t flex justify-between items-center">
                          <span className="text-sm font-medium">{os.tickets.clientes?.empresa || 'Cliente não definido'}</span>
                          <div className="flex gap-2">
                            {os.calendar_invite_sent_at && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="secondary"
                                      disabled={resendingInvite === os.id}
                                      onClick={() => resendCalendarInvite(os.id, os.numero_os)}
                                    >
                                      <Send className="h-4 w-4 mr-1" />
                                      {resendingInvite === os.id ? 'Enviando...' : 'Reenviar'}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Reenviar convite de calendário
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedOS(os);
                                setScheduleModalOpen(true);
                              }}
                            >
                              Reagendar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              disabled={cancelLoading}
                              onClick={async () => {
                                if (confirm(`Deseja realmente cancelar a OS ${os.numero_os}? Os convites de calendário serão removidos.`)) {
                                  const success = await cancelOS(os.id);
                                  if (success) {
                                    loadOrdensServico();
                                  }
                                }
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedOS && (
        <ScheduleModal
          open={scheduleModalOpen}
          onClose={() => {
            setScheduleModalOpen(false);
            setSelectedOS(null);
          }}
          osId={selectedOS.id}
          currentTecnicoId={selectedOS.tecnico_id}
          currentData={selectedOS.data_programada ? new Date(selectedOS.data_programada) : undefined}
          currentHoraInicio={selectedOS.hora_inicio || undefined}
          currentDuracao={selectedOS.duracao_estimada_min || undefined}
          onSuccess={loadOrdensServico}
        />
      )}
    </div>
  );
};

export default Agenda;
