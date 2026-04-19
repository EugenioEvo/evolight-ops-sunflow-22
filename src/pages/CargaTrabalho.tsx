import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, CheckCircle, AlertCircle, User, Download, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkloadData } from '@/features/workload';

const fmtHoras = (min: number) => `${Math.round(min / 60 * 10) / 10}h`;

const CargaTrabalho = () => {
  const {
    selectedMonth, setSelectedMonth, tecnicos, selectedTecnico, setSelectedTecnico,
    stats, loading, exporting, exportToPDF,
    horasDisponiveisMes, ocupacaoPercent,
    getOcupacaoColor, getOcupacaoStatus,
    getAderenciaColor, getAderenciaStatus,
  } = useWorkloadData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Carga de Trabalho</h1>
          <p className="text-muted-foreground">BI operacional — Meta (planejado) × Realizado (RME aprovado)</p>
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
          <Select value={selectedTecnico} onValueChange={setSelectedTecnico} disabled={tecnicos.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={tecnicos.length === 0 ? 'Nenhum técnico com OS' : 'Selecionar técnico'} />
            </SelectTrigger>
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
                const d = new Date(new Date().getFullYear(), new Date().getMonth() - 6 + i, 1);
                const val = format(d, 'yyyy-MM');
                return <SelectItem key={val} value={val}>{format(d, "MMMM 'de' yyyy", { locale: ptBR })}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
      ) : !selectedTecnico ? (
        <div className="text-center py-12 text-muted-foreground">Selecione um técnico para visualizar a carga.</div>
      ) : stats ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Total de OS', value: stats.totalOS, sub: 'No período', icon: Calendar },
              { title: 'Horas Previstas (Meta)', value: `${stats.totalHorasPrevistas}h`, sub: 'Soma de horas planejadas', icon: Target },
              { title: 'Horas Realizadas', value: `${stats.totalHorasRealizadas}h`, sub: 'A partir do RME aprovado', icon: Clock },
              { title: 'OS Concluídas', value: stats.osConcluidas, sub: `${stats.osPendentes} pendentes`, icon: CheckCircle, color: 'text-green-600' },
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

          {/* Aderência (Meta × Realizado) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Aderência à Meta</CardTitle>
              <CardDescription>Quanto do planejado foi realizado, segundo o RME aprovado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${getAderenciaColor(stats.aderencia)}`}>{stats.aderencia}%</div>
                  <Badge variant={stats.aderencia === 0 ? 'secondary' : (stats.aderencia >= 90 && stats.aderencia <= 110) ? 'default' : 'destructive'}>
                    {getAderenciaStatus(stats.aderencia)}
                  </Badge>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Meta: {stats.totalHorasPrevistas}h</p>
                  <p>Realizado: {stats.totalHorasRealizadas}h</p>
                  <p className={stats.variacaoMinutos > 0 ? 'text-red-600' : stats.variacaoMinutos < 0 ? 'text-green-600' : ''}>
                    Variação: {stats.variacaoMinutos >= 0 ? '+' : ''}{Math.round(stats.variacaoMinutos / 60 * 10) / 10}h
                    {stats.variacaoMinutos > 0 ? <TrendingUp className="inline ml-1 h-3 w-3" />
                      : stats.variacaoMinutos < 0 ? <TrendingDown className="inline ml-1 h-3 w-3" />
                      : <Minus className="inline ml-1 h-3 w-3" />}
                  </p>
                </div>
              </div>
              <Progress value={Math.min(150, stats.aderencia)} className="h-3" />
              <p className="text-xs text-muted-foreground">
                Verde 90–110% (no alvo). Amarelo 75–89% (abaixo). Vermelho &lt;75% ou &gt;110%.
              </p>
            </CardContent>
          </Card>

          {/* Ocupação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Ocupação do Mês</CardTitle>
              <CardDescription>Percentual da capacidade mensal alocada (base {horasDisponiveisMes}h)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${getOcupacaoColor(ocupacaoPercent)}`}>{ocupacaoPercent}%</div>
                  <Badge variant={ocupacaoPercent < 50 ? 'default' : ocupacaoPercent < 80 ? 'secondary' : 'destructive'}>
                    {getOcupacaoStatus(ocupacaoPercent)}
                  </Badge>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Alocado: {stats.totalHorasPrevistas}h</p>
                  <p>Disponível: {Math.max(0, horasDisponiveisMes - stats.totalHorasPrevistas)}h</p>
                </div>
              </div>
              <Progress value={ocupacaoPercent} className="h-3" />
            </CardContent>
          </Card>

          {/* Top 5 estouros */}
          {stats.topEstouros.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-600" />Top 5 — Maiores Estouros de Meta</CardTitle>
                <CardDescription>OS onde o realizado mais ultrapassou o previsto (ajuda a calibrar futuras estimativas)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">OS</th>
                        <th className="py-2 pr-3">Cliente</th>
                        <th className="py-2 pr-3">Meta</th>
                        <th className="py-2 pr-3">Realizado</th>
                        <th className="py-2 pr-3">Variação</th>
                        <th className="py-2 pr-3">Aderência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topEstouros.map(e => (
                        <tr key={e.ordem_servico_id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono text-xs">{e.numero_os}</td>
                          <td className="py-2 pr-3">{e.cliente}</td>
                          <td className="py-2 pr-3">{fmtHoras(e.minutos_previstos)}</td>
                          <td className="py-2 pr-3">{fmtHoras(e.minutos_realizados)}</td>
                          <td className={`py-2 pr-3 font-medium ${e.estouroMin > 0 ? 'text-red-600' : e.estouroMin < 0 ? 'text-green-600' : ''}`}>
                            {e.estouroMin >= 0 ? '+' : ''}{fmtHoras(e.estouroMin)}
                          </td>
                          <td className={`py-2 pr-3 font-medium ${getAderenciaColor(e.aderenciaOS)}`}>{e.aderenciaOS}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distribuição diária */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição Diária</CardTitle>
              <CardDescription>Meta × Realizado por dia do mês (barra mostra ocupação vs jornada de 8h)</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.workloadByDay.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma OS agendada neste mês</div>
              ) : (
                <div className="space-y-3">
                  {stats.workloadByDay.map((day) => {
                    const percentual = Math.min(100, (day.total_minutos_previstos / (8 * 60)) * 100);
                    return (
                      <div key={day.data} className="space-y-1">
                        <div className="flex justify-between text-sm flex-wrap gap-x-4">
                          <span className="font-medium">{format(new Date(day.data), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</span>
                          <div className="flex gap-3 text-muted-foreground text-xs items-center">
                            <span>{day.total_os} OS</span>
                            <span>Meta: <strong className="text-foreground">{fmtHoras(day.total_minutos_previstos)}</strong></span>
                            <span>Real: <strong className="text-foreground">{fmtHoras(day.total_minutos_realizados)}</strong></span>
                            <span className="text-yellow-600">{day.os_pendentes} pend.</span>
                            <span className="text-green-600">{day.os_concluidas} concl.</span>
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
