import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Calendar, Play, ClipboardList, Filter } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { TechnicianBreadcrumb } from "@/components/TechnicianBreadcrumb";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RecusaOSDialog } from "@/components/RecusaOSDialog";
import { useMyOrdersData } from "@/features/my-orders/hooks/useMyOrdersData";
import { useMyOrdersActions } from "@/features/my-orders/hooks/useMyOrdersActions";
import { OSCard } from "@/features/my-orders/components/OSCard";

const MinhasOS = () => {
  const {
    ordensServico, loading, prioridadeFiltro, setPrioridadeFiltro,
    activeTab, setActiveTab, isTecnico, canViewOS, loadOrdensServico,
    todas, pendentes, aguardandoGestaoCount, emExecucao, concluidas, recusadas,
  } = useMyOrdersData();

  const {
    startingId, navigating, exportingRMEId, recusaDialogOS, setRecusaDialogOS, aceiteLoading,
    handleIniciarExecucao, handlePreencherRME, handleVerOS, handleVerRMEPDF,
    handleLigarCliente, handleAbrirMapa, handleAceitarTicket, handleAceitarOS, handleRecusarOS,
  } = useMyOrdersActions(loadOrdensServico, setActiveTab);

  if (!canViewOS) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6">
          <p className="text-muted-foreground">Esta página é exclusiva para técnicos de campo e área técnica.</p>
        </CardContent></Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <TechnicianBreadcrumb current="minhas-os" />
        <LoadingState variant="card" count={6} />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-6">
        <TechnicianBreadcrumb current="minhas-os" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8" />Minhas Ordens de Serviço
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Gerencie suas ordens de serviço por status</p>
        </div>

        {ordensServico.length > 0 && (
          <Card><CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 flex items-center gap-2"><Filter className="h-4 w-4" />Prioridade</label>
                <Select value={prioridadeFiltro} onValueChange={setPrioridadeFiltro}>
                  <SelectTrigger><SelectValue placeholder="Todas as prioridades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {prioridadeFiltro !== 'todas' && (
                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={() => setPrioridadeFiltro('todas')}>Limpar Filtros</Button>
                </div>
              )}
            </div>
          </CardContent></Card>
        )}

        {ordensServico.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhuma OS atribuída" description="Você ainda não possui ordens de serviço atribuídas." />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
              <TabsTrigger value="todas" className="relative">
                Todas
                {todas.length > 0 && <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]">{todas.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="relative">
                Pendentes
                {pendentes.length > 0 && <Badge className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]">{pendentes.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="execucao" className="relative">
                Em Execução
                {emExecucao.length > 0 && <Badge className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]">{emExecucao.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="concluidas">
                Concluídas
                {concluidas.length > 0 && <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]">{concluidas.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="recusadas" className="relative">
                Recusadas
                {recusadas.length > 0 && (
                  <Badge variant="outline" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px] bg-red-50 text-red-700 border-red-200">
                    {recusadas.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {[
              { key: 'todas', data: todas, emptyIcon: ClipboardList, emptyTitle: 'Nenhuma OS ativa', emptyDesc: 'Você não possui ordens de serviço ativas no momento.' },
              { key: 'pendentes', data: pendentes, emptyIcon: Calendar, emptyTitle: 'Nenhuma OS pendente', emptyDesc: 'Todas as suas ordens de serviço já foram aceitas e iniciadas.' },
              { key: 'execucao', data: emExecucao, emptyIcon: Play, emptyTitle: 'Nenhuma OS em execução', emptyDesc: 'Inicie a execução de uma OS pendente para que ela apareça aqui.' },
              { key: 'concluidas', data: concluidas, emptyIcon: FileText, emptyTitle: 'Nenhuma OS concluída', emptyDesc: 'As ordens de serviço concluídas aparecerão aqui após a aprovação do RME.' },
              { key: 'recusadas', data: recusadas, emptyIcon: FileText, emptyTitle: 'Nenhuma OS recusada', emptyDesc: 'Você não recusou nenhuma ordem de serviço.' },
            ].map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="mt-6">
                {tab.data.length === 0 ? (
                  <EmptyState icon={tab.emptyIcon} title={tab.emptyTitle} description={tab.emptyDesc} />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tab.data.map(os => (
                      <OSCard key={os.id} os={os} isTecnico={isTecnico}
                        startingId={startingId} navigating={navigating} exportingRMEId={exportingRMEId} aceiteLoading={aceiteLoading}
                        onIniciarExecucao={handleIniciarExecucao} onPreencherRME={handlePreencherRME}
                        onVerOS={handleVerOS} onVerRMEPDF={handleVerRMEPDF} onLigarCliente={handleLigarCliente} onAbrirMapa={handleAbrirMapa}
                        onAceitarTicket={handleAceitarTicket} onAceitarOS={handleAceitarOS} onRecusarOS={(os) => setRecusaDialogOS(os)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      <RecusaOSDialog
        open={!!recusaDialogOS}
        onOpenChange={(open) => !open && setRecusaDialogOS(null)}
        onConfirm={handleRecusarOS}
        numeroOS={recusaDialogOS?.numero_os || ''}
        loading={aceiteLoading}
      />
    </TooltipProvider>
  );
};

export default MinhasOS;
