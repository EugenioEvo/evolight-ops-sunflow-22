import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, User, MapPin, X, Mail, CheckCircle, Send, AlertCircle, AlertTriangle, Edit } from 'lucide-react';
import { ScheduleModal } from '@/components/ScheduleModal';
import { EditTechnicianEmailDialog } from '@/components/EditTechnicianEmailDialog';
import { PresenceConfirmationStatus } from '@/components/PresenceConfirmationStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useScheduleData } from '@/features/schedule/hooks/useScheduleData';
import { useScheduleActions } from '@/features/schedule/hooks/useScheduleActions';
import type { AgendaOrdemServico } from '@/features/schedule/types';

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = { aberto: 'bg-blue-100 text-blue-800', em_analise: 'bg-yellow-100 text-yellow-800', aprovado: 'bg-green-100 text-green-800', em_execucao: 'bg-purple-100 text-purple-800', concluido: 'bg-gray-100 text-gray-800' };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getPrioridadeColor = (p: string) => {
  const colors: Record<string, string> = { baixa: 'bg-blue-100 text-blue-800', media: 'bg-yellow-100 text-yellow-800', alta: 'bg-orange-100 text-orange-800', urgente: 'bg-red-100 text-red-800' };
  return colors[p] || 'bg-gray-100 text-gray-800';
};

const getEmailStatus = (os: AgendaOrdemServico) => {
  const hasErrors = os.email_error_log && os.email_error_log.length > 0;
  const hasSentInvite = os.calendar_invite_sent_at;
  const hasEmail = os.tecnicos?.profiles?.email;
  if (!hasEmail) return { variant: 'secondary' as const, icon: AlertCircle, text: 'Sem email', color: 'text-muted-foreground border-muted-foreground' };
  if (hasErrors) return { variant: 'outline' as const, icon: AlertTriangle, text: 'Erro ao enviar', color: 'text-destructive border-destructive' };
  if (hasSentInvite) return { variant: 'outline' as const, icon: CheckCircle, text: 'Email enviado', color: 'text-green-600 border-green-600' };
  return { variant: 'outline' as const, icon: Mail, text: 'Pendente', color: 'text-yellow-600 border-yellow-600' };
};

const Agenda = () => {
  const { selectedDate, setSelectedDate, selectedTecnico, setSelectedTecnico, tecnicos, loading, osDoDia, diasComOS, loadOrdensServico } = useScheduleData();
  const { resendingInvite, cancelOS, cancelLoading, resendCalendarInvite, generatePresenceQR } = useScheduleActions(loadOrdensServico);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedOS, setSelectedOS] = useState<AgendaOrdemServico | null>(null);
  const [editEmailDialogOpen, setEditEmailDialogOpen] = useState(false);
  const [selectedTecnicoForEmail, setSelectedTecnicoForEmail] = useState<{ id: string; profileId: string; nome: string; email: string | null } | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-3xl font-bold">Agenda de Serviços</h1><p className="text-muted-foreground">Gerencie agendamentos e visualize a carga de trabalho</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" />Calendário</CardTitle><CardDescription>Selecione uma data para ver os agendamentos</CardDescription></CardHeader>
            <CardContent>
              <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} locale={ptBR} className="rounded-md border"
                modifiers={{ hasOS: (date) => { const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; return diasComOS[key] > 0; } }}
                modifiersClassNames={{ hasOS: 'bg-primary/10 font-bold' }}
              />
              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Filtrar por Técnico</label>
                <Select value={selectedTecnico} onValueChange={setSelectedTecnico}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Técnicos</SelectItem>
                    {tecnicos.map(tec => <SelectItem key={tec.id} value={tec.id}>{tec.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Agendamentos de {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
              <CardDescription>{osDoDia.length === 0 ? 'Nenhum agendamento para este dia' : `${osDoDia.length} agendamento(s) encontrado(s)`}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando agendamentos...</div>
              ) : osDoDia.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma OS agendada para este dia</div>
              ) : (
                <div className="space-y-4">
                  {osDoDia.map(os => {
                    const emailStatus = getEmailStatus(os);
                    const StatusIcon = emailStatus.icon;
                    return (
                      <Card key={os.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold">{os.numero_os}</h3>
                                <TooltipProvider><Tooltip><TooltipTrigger>
                                  <Badge variant={emailStatus.variant} className={`flex items-center gap-1 ${emailStatus.color}`}><StatusIcon className="h-3 w-3" />{emailStatus.text}</Badge>
                                </TooltipTrigger><TooltipContent className="max-w-xs">
                                  <div className="space-y-1">
                                    <p className="font-semibold">Status do Email</p>
                                    {!os.tecnicos?.profiles?.email && <p className="text-xs">Este técnico não possui email cadastrado.</p>}
                                    {os.calendar_invite_sent_at && (
                                      <><p className="text-xs">Enviado em: {format(new Date(os.calendar_invite_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                      {os.calendar_invite_recipients?.length && <div className="text-xs"><p className="font-medium mt-1">Destinatários:</p><ul className="list-disc list-inside">{os.calendar_invite_recipients.map((email, idx) => <li key={idx}>{email}</li>)}</ul></div>}</>
                                    )}
                                    {os.email_error_log?.length && <div className="text-xs text-destructive mt-2"><p className="font-medium">Última tentativa falhou:</p><p>{os.email_error_log[os.email_error_log.length - 1]?.error || 'Erro desconhecido'}</p></div>}
                                  </div>
                                </TooltipContent></Tooltip></TooltipProvider>
                                {os.presence_confirmed_at && <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />Presença Confirmada</Badge>}
                                <PresenceConfirmationStatus ordemServico={os} onGenerateQR={() => generatePresenceQR(os.id)} />
                              </div>
                              <p className="text-sm text-muted-foreground">{os.tickets.titulo}</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge className={getPrioridadeColor(os.tickets.prioridade)}>{os.tickets.prioridade}</Badge>
                              <Badge className={getStatusColor(os.tickets.status)}>{os.tickets.status.replace('_', ' ')}</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />{os.hora_inicio && os.hora_fim ? `${os.hora_inicio} - ${os.hora_fim}` : 'Horário não definido'}</div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-4 w-4" /><span className="flex-1">{os.tecnicos?.profiles?.nome || 'Não atribuído'}</span>
                              {os.tecnicos && (
                                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setSelectedTecnicoForEmail({ id: os.tecnicos!.id, profileId: os.tecnicos!.profile_id, nome: os.tecnicos!.profiles.nome, email: os.tecnicos!.profiles.email }); setEditEmailDialogOpen(true); }}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger><TooltipContent>Editar email do técnico</TooltipContent></Tooltip></TooltipProvider>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground col-span-2"><MapPin className="h-4 w-4" />{os.tickets.endereco_servico}</div>
                          </div>
                          <div className="mt-3 pt-3 border-t flex justify-between items-center">
                            <span className="text-sm font-medium">{os.tickets.clientes?.empresa || 'Cliente não definido'}</span>
                            <div className="flex gap-2">
                              {os.tecnicos?.profiles?.email && (
                                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                  <Button size="sm" variant="secondary" disabled={resendingInvite === os.id} onClick={() => resendCalendarInvite(os.id, os.numero_os)}>
                                    <Send className="h-4 w-4 mr-1" />{resendingInvite === os.id ? 'Enviando...' : 'Reenviar'}
                                  </Button>
                                </TooltipTrigger><TooltipContent>Reenviar convite de calendário</TooltipContent></Tooltip></TooltipProvider>
                              )}
                              <Button size="sm" variant="outline" onClick={() => { setSelectedOS(os); setScheduleModalOpen(true); }}>Reagendar</Button>
                              <Button size="sm" variant="destructive" disabled={cancelLoading} onClick={async () => {
                                if (confirm(`Deseja realmente cancelar a OS ${os.numero_os}?`)) {
                                  const success = await cancelOS(os.id);
                                  if (success) loadOrdensServico();
                                }
                              }}><X className="h-4 w-4 mr-1" />Cancelar</Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedOS && (
        <ScheduleModal open={scheduleModalOpen} onClose={() => { setScheduleModalOpen(false); setSelectedOS(null); }}
          osId={selectedOS.id} currentTecnicoId={selectedOS.tecnico_id}
          currentData={selectedOS.data_programada ? new Date(selectedOS.data_programada) : undefined}
          currentHoraInicio={selectedOS.hora_inicio || undefined}
          currentDuracao={selectedOS.duracao_estimada_min || undefined}
          onSuccess={loadOrdensServico}
        />
      )}
      {selectedTecnicoForEmail && (
        <EditTechnicianEmailDialog open={editEmailDialogOpen} onClose={() => { setEditEmailDialogOpen(false); setSelectedTecnicoForEmail(null); }}
          tecnicoId={selectedTecnicoForEmail.id} profileId={selectedTecnicoForEmail.profileId}
          currentEmail={selectedTecnicoForEmail.email} tecnicoNome={selectedTecnicoForEmail.nome} onSuccess={loadOrdensServico}
        />
      )}
    </div>
  );
};

export default Agenda;
