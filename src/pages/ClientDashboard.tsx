import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Ticket, Settings, Calendar, Clock, MapPin, FileText,
  AlertCircle, CheckCircle2, XCircle, Wrench, User, Building2, Mail, Phone
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { useClientDashData } from '@/features/client-dashboard';

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    aberto: 'bg-blue-100 text-blue-800 border-blue-200',
    aprovado: 'bg-green-100 text-green-800 border-green-200',
    ordem_servico_gerada: 'bg-purple-100 text-purple-800 border-purple-200',
    em_execucao: 'bg-orange-100 text-orange-800 border-orange-200',
    concluido: 'bg-gray-100 text-gray-800 border-gray-200',
    rejeitado: 'bg-red-100 text-red-800 border-red-200',
    cancelado: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'concluido': return <CheckCircle2 className="h-4 w-4" />;
    case 'em_execucao': return <Wrench className="h-4 w-4" />;
    case 'rejeitado': case 'cancelado': return <XCircle className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    aberto: 'Aberto', aprovado: 'Aprovado', ordem_servico_gerada: 'OS Gerada',
    em_execucao: 'Em Execução', concluido: 'Concluído', rejeitado: 'Rejeitado', cancelado: 'Cancelado',
  };
  return labels[status] || status;
};

const getRMEStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    aprovado: 'bg-green-100 text-green-800 border-green-200',
    rejeitado: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { loading, cliente, tickets, equipamentos, rmes, stats } = useClientDashData();

  if (loading) return <LoadingState />;

  if (!cliente) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertCircle} title="Perfil não encontrado" description="Não foi possível encontrar seus dados de cliente. Entre em contato com o suporte." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">Meu Painel</h1>
        <p className="text-muted-foreground">Acompanhe seus chamados, equipamentos e manutenções</p>
      </div>

      {/* Informações do Cliente */}
      <Card className="border-primary/20 shadow-solar">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Building2, label: 'Empresa', value: cliente.empresa },
              { icon: User, label: 'Responsável', value: cliente.profiles?.nome },
              { icon: Mail, label: 'Email', value: cliente.profiles?.email },
              { icon: Phone, label: 'Telefone', value: cliente.profiles?.telefone },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="font-medium text-sm">{value || 'Não informado'}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Chamados', value: stats.total, icon: Ticket, color: '' },
          { label: 'Em Aberto', value: stats.abertos, icon: Clock, color: 'border-blue-200 bg-blue-50/50 text-blue-700' },
          { label: 'Em Execução', value: stats.emExecucao, icon: Wrench, color: 'border-orange-200 bg-orange-50/50 text-orange-700' },
          { label: 'Concluídos', value: stats.concluidos, icon: CheckCircle2, color: 'border-green-200 bg-green-50/50 text-green-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className={`hover:shadow-lg transition-shadow ${color}`}>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold">{value}</p>
                <Icon className="h-8 w-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="tickets">Chamados</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          {tickets.length === 0 ? (
            <EmptyState icon={Ticket} title="Nenhum chamado" description="Você ainda não possui chamados registrados" />
          ) : (
            <div className="grid gap-4">
              {tickets.map((ticket) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{ticket.titulo}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{ticket.numero_ticket}</Badge>
                          {ticket.ordens_servico?.[0]?.numero_os && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              <FileText className="h-3 w-3 mr-1" />{ticket.ordens_servico[0].numero_os}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(ticket.status)}>
                        {getStatusIcon(ticket.status)}<span className="ml-1">{getStatusLabel(ticket.status)}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{ticket.descricao}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span className="truncate">{ticket.endereco_servico}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Settings className="h-4 w-4" /><span>{ticket.equipamento_tipo.replace('_', ' ')}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /><span>Aberto em {new Date(ticket.data_abertura).toLocaleDateString('pt-BR')}</span></div>
                      {ticket.ordens_servico?.[0]?.data_programada && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Agendado: {new Date(ticket.ordens_servico[0].data_programada).toLocaleDateString('pt-BR')}{ticket.ordens_servico[0].hora_inicio && ` às ${ticket.ordens_servico[0].hora_inicio}`}</span>
                        </div>
                      )}
                    </div>
                    {ticket.prestadores && (
                      <div className="pt-3 border-t">
                        <p className="text-sm"><span className="text-muted-foreground">Técnico: </span><span className="font-medium">{ticket.prestadores.nome}</span></p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipamentos" className="space-y-4">
          {equipamentos.length === 0 ? (
            <EmptyState icon={Settings} title="Nenhum equipamento" description="Você ainda não possui equipamentos cadastrados" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {equipamentos.map((equip) => (
                <Card key={equip.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div><CardTitle className="text-lg">{equip.nome}</CardTitle><CardDescription>{equip.tipo.replace('_', ' ')}</CardDescription></div>
                      <Badge variant={equip.status === 'ativo' ? 'default' : 'secondary'}>{equip.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {equip.fabricante && <p className="text-sm"><span className="text-muted-foreground">Fabricante: </span>{equip.fabricante}</p>}
                    {equip.modelo && <p className="text-sm"><span className="text-muted-foreground">Modelo: </span>{equip.modelo}</p>}
                    {equip.numero_serie && <p className="text-sm"><span className="text-muted-foreground">Série: </span>{equip.numero_serie}</p>}
                    {equip.capacidade && <p className="text-sm"><span className="text-muted-foreground">Capacidade: </span>{equip.capacidade}</p>}
                    {equip.localizacao && <p className="text-sm flex items-start gap-1"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" /><span className="text-muted-foreground">{equip.localizacao}</span></p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manutencoes" className="space-y-4">
          {rmes.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhuma manutenção" description="Ainda não há relatórios de manutenção para seus chamados" />
          ) : (
            <div className="grid gap-4">
              {rmes.map((rme) => (
                <Card key={rme.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />{(rme.tickets as any)?.titulo || 'Manutenção'}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{(rme.tickets as any)?.numero_ticket}</Badge>
                          {(rme.ordens_servico as any)?.numero_os && <Badge variant="outline" className="text-xs">{(rme.ordens_servico as any).numero_os}</Badge>}
                        </CardDescription>
                      </div>
                      <Badge className={getRMEStatusColor(rme.status_aprovacao)}>{rme.status_aprovacao}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /><span>Técnico: {((rme.tecnicos as any)?.profiles as any)?.nome || 'N/A'}</span></div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /><span>Execução: {new Date(rme.data_execucao).toLocaleDateString('pt-BR')}</span></div>
                    </div>
                    {rme.servicos_executados && <div className="pt-2 border-t"><p className="text-sm font-medium mb-1">Serviços Executados:</p><p className="text-sm text-muted-foreground">{rme.servicos_executados}</p></div>}
                    {rme.observacoes_tecnicas && <div className="pt-2 border-t"><p className="text-sm font-medium mb-1">Observações:</p><p className="text-sm text-muted-foreground">{rme.observacoes_tecnicas}</p></div>}
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

export default ClientDashboard;
