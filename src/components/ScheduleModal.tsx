import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { useSchedule } from '@/hooks/useSchedule';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';

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
  };
}

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
  const [horaInicio, setHoraInicio] = useState(currentHoraInicio || '08:00');
  const [duracaoHoras, setDuracaoHoras] = useState(currentDuracao ? String(currentDuracao / 60) : '2');
  const { scheduleOS, loading } = useSchedule();

  // Atualizar estados quando props mudarem
  useEffect(() => {
    if (currentTecnicoId) setSelectedTecnico(currentTecnicoId);
    if (currentData) setSelectedDate(currentData);
    if (currentHoraInicio) setHoraInicio(currentHoraInicio);
    if (currentDuracao) setDuracaoHoras(String(currentDuracao / 60));
  }, [currentTecnicoId, currentData, currentHoraInicio, currentDuracao]);

  useEffect(() => {
    loadTecnicos();
  }, []);

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('tecnicos')
      .select('id, profiles!inner(nome)')
      .order('profiles(nome)');
    
    if (data) setTecnicos(data as any);
  };

  const calcularHoraFim = (inicio: string, duracaoH: string) => {
    const [h, m] = inicio.split(':').map(Number);
    const duracao = parseFloat(duracaoH);
    const totalMinutos = h * 60 + m + duracao * 60;
    const novaHora = Math.floor(totalMinutos / 60);
    const novoMinuto = totalMinutos % 60;
    return `${String(novaHora).padStart(2, '0')}:${String(novoMinuto).padStart(2, '0')}`;
  };

  const handleSchedule = async () => {
    if (!selectedTecnico || !selectedDate) return;

    const horaFim = calcularHoraFim(horaInicio, duracaoHoras);
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

  const horariosDisponiveis = Array.from({ length: 20 }, (_, i) => {
    const hora = 6 + i;
    return `${String(hora).padStart(2, '0')}:00`;
  });

  const duracoes = ['0.5', '1', '1.5', '2', '3', '4', '6', '8'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
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
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Data
            </Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
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
              <Label>Duração (horas)</Label>
              <Select value={duracaoHoras} onValueChange={setDuracaoHoras}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {duracoes.map(d => (
                    <SelectItem key={d} value={d}>
                      {d}h ({d === '0.5' ? '30min' : `${parseFloat(d) * 60}min`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedDate && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Resumo do Agendamento</p>
              <p className="text-sm text-muted-foreground mt-1">
                {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground">
                {horaInicio} às {calcularHoraFim(horaInicio, duracaoHoras)} ({duracaoHoras}h)
              </p>
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
            {loading ? 'Agendando...' : 'Agendar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
