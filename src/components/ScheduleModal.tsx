import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { useSchedule } from '@/hooks/useSchedule';
import { useConflictCheck } from '@/hooks/useConflictCheck';
import { ConflictWarning } from '@/components/ConflictWarning';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, AlertCircle, Mail, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { computeScheduleEnd, formatScheduledWindow } from '@/utils/scheduleWindow';

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  osId: string;
  currentTecnicoId?: string;
  currentData?: Date;
  currentHoraInicio?: string;
  currentDuracao?: number;
  onSuccess?: () => void;
}

interface Tecnico {
  id: string;
  profiles: {
    nome: string;
    email: string;
  };
}

// Normaliza "HH:mm" ou "HH:mm:ss" -> "HH:mm"
const normalizeHora = (h?: string) => {
  if (!h) return '08:00';
  const parts = h.split(':');
  return `${parts[0].padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}`;
};

export const ScheduleModal = ({ 
  open, 
  onClose, 
  osId, 
  currentTecnicoId,
  currentData,
  currentHoraInicio,
  currentDuracao,
  onSuccess 
}: ScheduleModalProps) => {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState<string>(currentTecnicoId || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(currentData);
  const [horaInicio, setHoraInicio] = useState(normalizeHora(currentHoraInicio));
  const [duracaoHoras, setDuracaoHoras] = useState(currentDuracao ? String(currentDuracao / 60) : '2');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [existingSchedules, setExistingSchedules] = useState<any[]>([]);
  const { scheduleOS, loading } = useSchedule();
  const { checkTechnicianConflict, getTechnicianSchedule } = useConflictCheck();

  // Inicializa estados apenas quando o modal abre — evita sobrescrever
  // as escolhas do usuário se o componente pai re-renderizar e passar
  // novas instâncias das props (ex.: novo Date em currentData).
  useEffect(() => {
    if (!open) return;
    if (currentTecnicoId) setSelectedTecnico(currentTecnicoId);
    if (currentData) setSelectedDate(currentData);
    setHoraInicio(normalizeHora(currentHoraInicio));
    if (currentDuracao) setDuracaoHoras(String(currentDuracao / 60));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    loadTecnicos();
  }, []);

  // Verificar se técnico selecionado tem email
  const tecnicoSelecionado = tecnicos.find(t => t.id === selectedTecnico);
  const tecnicoSemEmail = tecnicoSelecionado && !tecnicoSelecionado.profiles?.email;

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('tecnicos')
      .select('id, profiles!inner(nome, email)')
      .order('profiles(nome)');
    
    if (data) setTecnicos(data as any);
  };

  const toISODate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Cálculo respeitando janela útil (08-18, dias úteis) — mesma regra das OS
  const schedWindow = useMemo(() => {
    if (!selectedDate) return null;
    const dur = parseFloat(duracaoHoras);
    if (!dur || dur <= 0) return null;
    return computeScheduleEnd(toISODate(selectedDate), horaInicio, Math.round(dur * 60));
  }, [selectedDate, horaInicio, duracaoHoras]);

  const startDateTime = useMemo(() => {
    if (!selectedDate) return null;
    const [h, m] = horaInicio.split(':').map(Number);
    const d = new Date(selectedDate);
    d.setHours(h, m, 0, 0);
    return d;
  }, [selectedDate, horaInicio]);

  const endDateTime = useMemo(() => {
    if (!schedWindow) return null;
    const [y, mo, d] = schedWindow.endDate.split('-').map(Number);
    const [h, m] = schedWindow.endTime.split(':').map(Number);
    return new Date(y, mo - 1, d, h, m, 0, 0);
  }, [schedWindow]);

  const diasAtravessados = startDateTime && endDateTime
    ? differenceInCalendarDays(endDateTime, startDateTime)
    : 0;

  // Verificar conflitos quando mudar técnico, data ou horário
  useEffect(() => {
    const checkConflicts = async () => {
      if (!selectedTecnico || !selectedDate) {
        setConflicts([]);
        return;
      }

      const horaFim = schedWindow?.endTime || horaInicio;
      const result = await checkTechnicianConflict(
        selectedTecnico,
        selectedDate,
        horaInicio,
        horaFim,
        osId
      );

      setConflicts(result.conflicts);
    };

    checkConflicts();
  }, [selectedTecnico, selectedDate, horaInicio, duracaoHoras]);

  // Carregar agenda existente do técnico
  useEffect(() => {
    const loadSchedule = async () => {
      if (!selectedTecnico || !selectedDate) {
        setExistingSchedules([]);
        return;
      }

      const schedules = await getTechnicianSchedule(selectedTecnico, selectedDate);
      setExistingSchedules(schedules);
    };

    loadSchedule();
  }, [selectedTecnico, selectedDate]);

  const handleSchedule = async () => {
    if (!selectedTecnico || !selectedDate) return;
    // Conflitos viram apenas alerta — não bloqueiam o agendamento.

    const horaFim = schedWindow?.endTime || horaInicio;
    const duracaoMin = parseFloat(duracaoHoras) * 60;

    const success = await scheduleOS({
      osId,
      tecnicoId: selectedTecnico,
      data: selectedDate,
      horaInicio,
      horaFim,
      duracaoMin
    });

    if (success) {
      onSuccess?.();
      onClose();
    }
  };

  // Horários de 00:01 até 23:59 em múltiplos de 30 minutos (00:01, 00:30, 01:00, ..., 23:30, 23:59)
  const horariosBase = useMemo(() => {
    const arr: string[] = ['00:01'];
    for (let mins = 30; mins <= 23 * 60 + 30; mins += 30) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      arr.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    arr.push('23:59');
    return arr;
  }, []);
  // Garante que o horário atual (mesmo fora da grade padrão) apareça
  const horariosDisponiveis = useMemo(() => {
    const set = new Set(horariosBase);
    if (horaInicio) set.add(horaInicio);
    return Array.from(set).sort();
  }, [horaInicio, horariosBase]);

  const duracoesBase = ['0.5', '1', '1.5', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12'];
  const duracoes = useMemo(() => {
    const set = new Set(duracoesBase);
    if (duracaoHoras) set.add(duracaoHoras);
    return Array.from(set).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [duracaoHoras]);

  // Range visual no calendário quando atravessa dias
  const rangeModifier = useMemo(() => {
    if (!startDateTime || !endDateTime || diasAtravessados <= 0) return undefined;
    const dias: Date[] = [];
    for (let i = 0; i <= diasAtravessados; i++) {
      const d = new Date(selectedDate!);
      d.setDate(d.getDate() + i);
      dias.push(d);
    }
    return dias;
  }, [selectedDate, startDateTime, endDateTime, diasAtravessados]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Ordem de Serviço</DialogTitle>
          <DialogDescription>
            Selecione data, técnico e horário para esta OS
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label>Técnico</Label>
            <Select value={selectedTecnico} onValueChange={setSelectedTecnico}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o técnico" />
              </SelectTrigger>
              <SelectContent>
                {tecnicos.map(tec => (
                  <SelectItem key={tec.id} value={tec.id}>
                    {tec.profiles.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tecnicoSemEmail && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 flex items-start gap-2">
                <Mail className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm text-destructive">
                  <p className="font-medium">Email não cadastrado</p>
                  <p className="text-xs mt-1">
                    Este técnico não possui email cadastrado. O agendamento será salvo, mas não será possível enviar convites de calendário nem lembretes.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Data
            </Label>
            <div className="flex justify-center rounded-md border">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                modifiers={rangeModifier ? { intervalo: rangeModifier } : undefined}
                modifiersClassNames={{
                  intervalo: 'bg-primary/20 text-primary-foreground rounded-none',
                }}
                className="pointer-events-auto"
              />
            </div>
            {diasAtravessados > 0 && (
              <p className="text-xs text-muted-foreground">
                Este agendamento se estende por {diasAtravessados + 1} dia(s).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário de Início
              </Label>
              <Select value={horaInicio} onValueChange={setHoraInicio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {horariosDisponiveis.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="duracao-horas">Duração (horas)</Label>
              <Input
                id="duracao-horas"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={duracaoHoras}
                onChange={(e) => setDuracaoHoras(e.target.value || '1')}
                placeholder="Ex: 2.5"
              />
            </div>
          </div>

          {/* Avisos de conflito */}
          <ConflictWarning 
            conflicts={conflicts}
            technicianName={tecnicos.find(t => t.id === selectedTecnico)?.profiles.nome}
          />

          {/* Agenda existente */}
          {existingSchedules.length > 0 && conflicts.length === 0 && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                Outros agendamentos neste dia:
              </div>
              <div className="space-y-1">
                {existingSchedules.map((schedule, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {schedule.osNumber}
                    </Badge>
                    <span>{schedule.startTime} - {schedule.endTime}</span>
                    {schedule.ticketTitle && (
                      <span className="text-muted-foreground truncate">
                        {schedule.ticketTitle}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDate && startDateTime && endDateTime && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Resumo do Agendamento</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">Início:</span>{' '}
                {format(startDateTime, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Fim:</span>{' '}
                {format(endDateTime, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Duração total: {duracaoHoras}h
                {diasAtravessados > 0 && ` · atravessa ${diasAtravessados} dia(s)`}
              </p>
              {schedWindow?.outOfWindowWarning && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  Hora de início fora da janela útil (08:00–18:00). O término foi calculado reprogramando para o próximo slot válido.
                </p>
              )}
              {schedWindow?.crossedDay && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  A duração ultrapassa a janela útil — o serviço se estende para o(s) próximo(s) dia(s) útil(eis).
                </p>
              )}
              {schedWindow?.weekendWarning && (
                <p className="text-xs text-destructive mt-1 flex items-start gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  A data selecionada cai em fim de semana. O serviço foi automaticamente movido para a próxima segunda-feira.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSchedule} 
            disabled={!selectedTecnico || !selectedDate || loading}
          >
            {loading ? 'Agendando...' : conflicts.length > 0 ? 'Agendar mesmo assim' : 'Agendar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
