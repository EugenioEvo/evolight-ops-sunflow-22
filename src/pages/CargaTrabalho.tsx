import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, CheckCircle, AlertCircle, User, Download } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkloadData } from '@/features/workload';

const CargaTrabalho = () => {
  const {
    selectedMonth, setSelectedMonth, tecnicos, selectedTecnico, setSelectedTecnico,
    stats, loading, exporting, exportToPDF,
    getDisponibilidadeColor, getDisponibilidadeStatus,
  } = useWorkloadData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Carga de Trabalho</h1>
          <p className="text-muted-foreground">Visualize a distribuição de trabalho dos técnicos</p>
        </div>
        {stats && (
          <Button onClick={exportToPDF} disabled={exporting} className="flex items-center gap-2">
            <Download className="h-4 w-4" />{exporting ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Técnico</label>
          <Select value={selectedTecnico} onValueChange={setSelectedTecnico}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {tecnicos.map(tec => <SelectItem key={tec.id} value={tec.id}>{tec.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Mês</label>
          <Select
            value={format(selectedMonth, 'yyyy-MM')}
            onValueChange={(value) => { const [y, m] = value.split('-').map(Number); setSelectedMonth(new Date(y, m - 1, 1)); }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - 6 + i);
                return <SelectItem key={i} value={format(d, 'yyyy-MM')}>{format(d, "MMMM 'de' yyyy", { locale: ptBR })}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Total de OS', value: stats.totalOS, sub: 'Agendadas este mês', icon: Calendar },
              { title: 'Total de Horas', value: `${stats.totalHoras}h`, sub: 'Tempo estimado', icon: Clock },
              { title: 'OS Pendentes', value: stats.osPendentes, sub: 'Aguardando execução', icon: AlertCircle, color: 'text-yellow-600' },
              { title: 'OS Concluídas', value: stats.osConcluidas, sub: 'Finalizadas', icon: CheckCircle, color: 'text-green-600' },
            ].map(({ title, value, sub, icon: Icon, color }) => (
              <Card key={title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{title}</CardTitle>
                  <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${color || ''}`}>{value}</div>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Disponibilidade</CardTitle>
              <CardDescription>Percentual de ocupação do técnico no mês (baseado em 176h mensais)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${getDisponibilidadeColor(stats.disponibilidade)}`}>{stats.disponibilidade}%</div>
                  <Badge variant={stats.disponibilidade < 50 ? 'default' : stats.disponibilidade < 80 ? 'secondary' : 'destructive'}>
                    {getDisponibilidadeStatus(stats.disponibilidade)}
                  </Badge>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Ocupado: {stats.totalHoras}h</p>
                  <p>Disponível: {Math.max(0, 176 - stats.totalHoras)}h</p>
                </div>
              </div>
              <Progress value={stats.disponibilidade} className="h-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição Diária</CardTitle>
              <CardDescription>Carga de trabalho por dia do mês</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.workloadByDay.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma OS agendada neste mês</div>
              ) : (
                <div className="space-y-2">
                  {stats.workloadByDay.map((day) => {
                    const horas = Math.round(day.total_minutos / 60 * 10) / 10;
                    const percentual = Math.min(100, (day.total_minutos / (8 * 60)) * 100);
                    return (
                      <div key={day.data} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{format(new Date(day.data), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</span>
                          <div className="flex gap-4 text-muted-foreground">
                            <span>{day.total_os} OS</span><span>{horas}h</span>
                            <span className="text-yellow-600">{day.os_pendentes} pendentes</span>
                            <span className="text-green-600">{day.os_concluidas} concluídas</span>
                          </div>
                        </div>
                        <Progress value={percentual} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default CargaTrabalho;
