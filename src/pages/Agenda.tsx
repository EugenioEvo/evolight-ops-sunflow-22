import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, User, MapPin } from 'lucide-react';
import { ScheduleModal } from '@/components/ScheduleModal';
import { useTicketsRealtime } from '@/hooks/useTicketsRealtime';

interface OrdemServico {
  id: string;
  numero_os: string;
  data_programada: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_estimada_min: number | null;
  tecnico_id: string;
  prestadores: {
    id: string;
    nome: string;
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
          prestadores!tecnico_id(
            id,
            nome
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
                          <div>
                            <h3 className="font-semibold">{os.numero_os}</h3>
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
                            {os.prestadores?.nome || 'Não atribuído'}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                            <MapPin className="h-4 w-4" />
                            {os.tickets.endereco_servico}
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t flex justify-between items-center">
                          <span className="text-sm font-medium">{os.tickets.clientes.empresa}</span>
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
