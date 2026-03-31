import { usePresenceData, usePresenceExport } from '@/features/presence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Users, MapPin, Filter, FileDown, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PresenceDashboard } from '@/components/PresenceDashboard';

export default function DashboardPresenca() {
  const {
    ordensServico, ordensServicoFiltradas, tecnicos, loading, exporting, setExporting,
    filtroTecnico, setFiltroTecnico, filtroStatus, setFiltroStatus,
    filtroHorario, setFiltroHorario, statsFiltradas, temFiltrosAtivos, limparFiltros,
  } = usePresenceData();

  const { exportarPDF, exportarExcel } = usePresenceExport(ordensServicoFiltradas, statsFiltradas, setExporting);

  if (loading) {
    return <div className="p-6"><div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Confirmações</h1>
          <p className="text-muted-foreground">Acompanhamento em tempo real das confirmações de presença do dia</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportarPDF} disabled={exporting || ordensServicoFiltradas.length === 0} variant="outline"><FileDown className="h-4 w-4 mr-2" />Exportar PDF</Button>
          <Button onClick={exportarExcel} disabled={exporting || ordensServicoFiltradas.length === 0} variant="outline"><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel</Button>
        </div>
      </div>

      <PresenceDashboard />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Técnico</label>
              <Select value={filtroTecnico} onValueChange={setFiltroTecnico}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tecnicos.map(t => <SelectItem key={t.id} value={t.id}>{t.profiles?.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Horário</label>
              <Select value={filtroHorario} onValueChange={setFiltroHorario}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="manha">Manhã (6h-12h)</SelectItem>
                  <SelectItem value="tarde">Tarde (12h-18h)</SelectItem>
                  <SelectItem value="noite">Noite (18h-6h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button variant="outline" onClick={limparFiltros} disabled={!temFiltrosAtivos} className="w-full">Limpar Filtros</Button></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de OS</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{statsFiltradas.total}</div><p className="text-xs text-muted-foreground">Agendadas para hoje</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Confirmadas</CardTitle><CheckCircle2 className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{statsFiltradas.confirmadas}</div><p className="text-xs text-muted-foreground">{statsFiltradas.total > 0 ? Math.round((statsFiltradas.confirmadas / statsFiltradas.total) * 100) : 0}% do total</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pendentes</CardTitle><Clock className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{statsFiltradas.pendentes}</div><p className="text-xs text-muted-foreground">Aguardando confirmação</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ordens de Serviço - {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            {temFiltrosAtivos && <Badge variant="secondary">{ordensServicoFiltradas.length} de {ordensServico.length} resultados</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordensServicoFiltradas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>{temFiltrosAtivos ? 'Nenhuma OS encontrada com os filtros' : 'Nenhuma OS agendada para hoje'}</p></div>
          ) : (
            <div className="space-y-4">
              {ordensServicoFiltradas.map(os => (
                <div key={os.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{os.numero_os}</h3>
                      {os.presence_confirmed_at ? <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmada</Badge> : <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{os.tickets?.titulo}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{os.hora_inicio && os.hora_fim ? `${os.hora_inicio.slice(0, 5)} - ${os.hora_fim.slice(0, 5)}` : 'Horário não definido'}</div>
                      <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{os.tickets?.endereco_servico}</div>
                    </div>
                  </div>
                  <div className="mt-3 md:mt-0 md:ml-4 flex flex-col items-start md:items-end gap-1">
                    <div className="text-sm font-medium">{os.tecnicos?.profiles?.nome || 'Não atribuído'}</div>
                    {os.tickets?.clientes?.empresa && <div className="text-sm text-muted-foreground">{os.tickets.clientes.empresa}</div>}
                    {os.presence_confirmed_at && <div className="text-xs text-muted-foreground">Confirmada em {format(new Date(os.presence_confirmed_at), 'HH:mm', { locale: ptBR })}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
