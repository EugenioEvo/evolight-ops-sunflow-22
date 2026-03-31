import React from 'react';
import { useReportData } from '@/features/reports';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { exportToExcel, exportToCSV, exportToPDF } from '@/utils/exportHelpers';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, FileText, Clock, CheckCircle, Calendar, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Relatorios = () => {
  const {
    tickets, rmes, ordensServico, dateRange, setDateRange,
    getTicketsByStatus, getTicketsByPriority, getTicketsByMonth, getTechnicianPerformance,
  } = useReportData();
  const { toast } = useToast();

  const handleExport = (format: 'excel' | 'csv' | 'pdf') => {
    const data = tickets.map((t: any) => ({
      'Número': t.numero_ticket, 'Título': t.titulo, 'Status': t.status,
      'Prioridade': t.prioridade, 'Cliente': t.clientes?.empresa || t.clientes?.profiles?.nome,
      'Criado em': new Date(t.created_at).toLocaleDateString('pt-BR'),
    }));
    const filename = `relatorio_tickets_${dateRange.start}_${dateRange.end}`;
    if (format === 'excel') { exportToExcel(data, filename); toast({ title: 'Exportado!', description: 'Excel gerado.' }); }
    else if (format === 'csv') { exportToCSV(data, filename); toast({ title: 'Exportado!', description: 'CSV gerado.' }); }
    else {
      const columns = [{ header: 'Número', dataKey: 'Número' }, { header: 'Título', dataKey: 'Título' }, { header: 'Status', dataKey: 'Status' }, { header: 'Prioridade', dataKey: 'Prioridade' }, { header: 'Cliente', dataKey: 'Cliente' }, { header: 'Criado em', dataKey: 'Criado em' }];
      exportToPDF(data, filename, 'Relatório de Tickets', columns);
      toast({ title: 'Exportado!', description: 'PDF gerado.' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Relatórios</h1><p className="text-muted-foreground">Dashboard de métricas e análises</p></div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-40" />
            <span>até</span>
            <Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-40" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><Download className="h-4 w-4 mr-2" />Exportar</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Tickets</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{tickets.length}</div><p className="text-xs text-muted-foreground">no período</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">RMEs Concluídos</CardTitle><CheckCircle className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{rmes.length}</div><p className="text-xs text-muted-foreground">finalizados</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ordens de Serviço</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{ordensServico.length}</div><p className="text-xs text-muted-foreground">geradas</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{tickets.length > 0 ? Math.round((rmes.length / tickets.length) * 100) : 0}%</div><p className="text-xs text-muted-foreground">concluídos</p></CardContent></Card>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="tecnicos">Produtividade</TabsTrigger>
          <TabsTrigger value="rmes">RMEs e Aprovações</TabsTrigger>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle>Tickets por Status</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={getTicketsByStatus()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#8884d8" /></BarChart></ResponsiveContainer></CardContent></Card>
            <Card><CardHeader><CardTitle>Tickets por Prioridade</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={getTicketsByPriority()} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{getTicketsByPriority().map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Evolução de Tickets</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><LineChart data={getTicketsByMonth()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="tickets" stroke="#8884d8" strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card>
        </TabsContent>

        <TabsContent value="tecnicos" className="space-y-6">
          <Card><CardHeader><CardTitle>Performance dos Técnicos</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={400}><BarChart data={getTechnicianPerformance()}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nome" /><YAxis /><Tooltip /><Bar dataKey="tickets_atribuidos" fill="#8884d8" name="Tickets" /><Bar dataKey="rmes_completados" fill="#82ca9d" name="RMEs" /></BarChart></ResponsiveContainer></CardContent></Card>
          <div className="grid gap-4">{getTechnicianPerformance().map((t, i) => (
            <Card key={i}><CardHeader><CardTitle className="text-lg">{t.nome}</CardTitle></CardHeader><CardContent><div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-2xl font-bold text-blue-600">{t.tickets_atribuidos}</div><p className="text-sm text-muted-foreground">Tickets</p></div>
              <div><div className="text-2xl font-bold text-green-600">{t.rmes_completados}</div><p className="text-sm text-muted-foreground">RMEs</p></div>
              <div><div className="text-2xl font-bold text-purple-600">{t.taxa_conclusao}%</div><p className="text-sm text-muted-foreground">Conclusão</p></div>
            </div></CardContent></Card>
          ))}</div>
        </TabsContent>

        <TabsContent value="rmes" className="space-y-6">
          <Card><CardHeader><CardTitle>Status de Aprovação dos RMEs</CardTitle></CardHeader><CardContent><div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center"><div className="text-3xl font-bold text-yellow-600">{rmes.filter((r: any) => r.status_aprovacao === 'pendente').length}</div><p className="text-sm text-muted-foreground">Pendentes</p></div>
            <div className="text-center"><div className="text-3xl font-bold text-green-600">{rmes.filter((r: any) => r.status_aprovacao === 'aprovado').length}</div><p className="text-sm text-muted-foreground">Aprovados</p></div>
            <div className="text-center"><div className="text-3xl font-bold text-red-600">{rmes.filter((r: any) => r.status_aprovacao === 'rejeitado').length}</div><p className="text-sm text-muted-foreground">Rejeitados</p></div>
          </div></CardContent></Card>
        </TabsContent>

        <TabsContent value="detalhes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle>Tickets Recentes</CardTitle></CardHeader><CardContent><div className="space-y-4 max-h-96 overflow-y-auto">{tickets.slice(0, 10).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded"><div><p className="font-medium">{t.titulo}</p><p className="text-sm text-muted-foreground">{t.clientes?.empresa || t.clientes?.profiles?.nome}</p></div><Badge variant="outline">{t.status.replace('_', ' ')}</Badge></div>
            ))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle>RMEs Recentes</CardTitle></CardHeader><CardContent><div className="space-y-4 max-h-96 overflow-y-auto">{rmes.slice(0, 10).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded"><div><p className="font-medium">{r.tickets?.titulo}</p><p className="text-sm text-muted-foreground">Técnico: {r.tecnicos?.profiles?.nome}</p></div><Badge variant="outline">{new Date(r.data_execucao).toLocaleDateString('pt-BR')}</Badge></div>
            ))}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
