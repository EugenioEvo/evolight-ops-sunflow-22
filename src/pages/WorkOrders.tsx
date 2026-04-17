import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/shared/services/notificationService";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, Search, Calendar, MapPin, Users, 
  Clock, FileText, AlertTriangle, CheckCircle2, 
  PlayCircle, XCircle, Loader2, ChevronDown, Star, Trash2, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Pagination } from "@/components/Pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useWorkOrderData, useWorkOrderFilters, workOrderService } from "@/features/work-orders";
import type { WorkOrder } from "@/features/work-orders";
import { MultiTechnicianOSDialog } from "@/components/MultiTechnicianOSDialog";
import { supabase } from "@/integrations/supabase/client";
import { RME_STATUS_LABEL, RME_STATUS_BADGE_CLASS, normalizeRMEStatus } from "@/utils/rmeStatus";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  aberta: { label: "Aberta", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: FileText },
  em_execucao: { label: "Em Execução", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: PlayCircle },
  concluida: { label: "Concluída", color: "bg-green-500/10 text-green-600 border-green-200", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-red-500/10 text-red-600 border-red-200", icon: XCircle },
};

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  media: { label: "Média", color: "bg-blue-100 text-blue-700" },
  alta: { label: "Alta", color: "bg-amber-100 text-amber-700" },
  critica: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

const WorkOrders = () => {
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [prestadores, setPrestadores] = useState<Array<{ id: string; nome: string; email: string }>>([]);
  const [standaloneClientes, setStandaloneClientes] = useState<Array<{ id: string; empresa: string | null; ufv_solarz: string | null; endereco: string | null; cidade: string | null; estado: string | null }>>([]);
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canManageOS = profile?.role === "admin" || profile?.role === "engenharia" || profile?.role === "supervisao";

  const { workOrders, clientes, loading, setLoading, loadWorkOrders, ufvSolarzOptions, stats } = useWorkOrderData();
  const filters = useWorkOrderFilters(workOrders);

  // Load prestadores + clientes (with full address) for the standalone dialog
  useEffect(() => {
    if (!canManageOS) return;
    (async () => {
      const [{ data: prestData }, { data: cliData }] = await Promise.all([
        supabase.from('prestadores').select('id, nome, email').eq('categoria', 'tecnico').eq('ativo', true).order('nome'),
        supabase.from('clientes').select('id, empresa, ufv_solarz, endereco, cidade, estado').order('empresa'),
      ]);
      setPrestadores((prestData || []) as any);
      setStandaloneClientes((cliData || []) as any);
    })();
  }, [canManageOS]);

  const getOSStatus = (os: WorkOrder) => {
    const ticketStatus = os.tickets.status;
    if (ticketStatus === "concluido") return "concluida";
    if (ticketStatus === "em_execucao") return "em_execucao";
    if (ticketStatus === "cancelado") return "cancelada";
    return "aberta";
  };

  const hasRME = (os: WorkOrder) => os.rme_relatorios && os.rme_relatorios.length > 0;
  const isRMECompleted = (os: WorkOrder) => os.rme_relatorios?.some((r) => r.status === "concluido");

  const handleDeleteOS = async (e: React.MouseEvent, osId: string, ticketId: string) => {
    e.stopPropagation();
    try {
      setLoading(true);
      const osData = await workOrderService.getOSWithDetails(osId);
      if (!osData) throw new Error("OS não encontrada");

      if (osData.tickets?.status === "em_execucao") {
        toast({ title: "Exclusão bloqueada", description: `A OS está em execução. Não é possível excluí-la.`, variant: "destructive" });
        return;
      }

      const tecnicoUserId = (osData.tecnicos as any)?.profile?.user_id;
      if (tecnicoUserId) {
        try {
          await notificationService.sendCalendarInvite(osId, "cancel");
        } catch (e) {
          console.error("Erro ao enviar email de cancelamento:", e);
        }
      }

      await workOrderService.deleteOS(osId);
      await workOrderService.revertTicketToApproved(ticketId);

      if (tecnicoUserId) {
        await notificationService.sendInApp(
          tecnicoUserId, "os_cancelada", "Ordem de Serviço Cancelada",
          `A OS ${(osData as any).numero_os} foi cancelada pelo administrador.`,
          "/minhas-os"
        );
      }

      toast({ title: "OS excluída", description: "Ordem de serviço excluída e ticket revertido para aprovado." });
      loadWorkOrders();
    } catch (error: any) {
      toast({ title: "Erro ao excluir OS", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e: React.MouseEvent, osId: string) => {
    e.stopPropagation();
    setSendingEmailId(osId);
    try {
      await notificationService.sendCalendarInvite(osId, "create");
      toast({ title: "Email enviado!", description: "Convite enviado com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao enviar email", description: error.message, variant: "destructive" });
    } finally {
      setSendingEmailId(null);
    }
  };

  if (loading) {
    return <div className="p-4 sm:p-6"><LoadingState variant="card" count={6} /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
          <p className="text-muted-foreground">Gerencie as ordens de serviço e RMEs</p>
        </div>
        {canManageOS && (
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />Nova OS
          </Button>
        )}
      </div>

      <MultiTechnicianOSDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        prestadores={prestadores}
        clientes={standaloneClientes}
        onSuccess={loadWorkOrders}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => filters.setStatusFilter("all")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => filters.setStatusFilter("aberta")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><FileText className="h-5 w-5 text-blue-500" /></div>
              <div><p className="text-2xl font-bold">{stats.abertas}</p><p className="text-xs text-muted-foreground">Abertas</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => filters.setStatusFilter("em_execucao")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><PlayCircle className="h-5 w-5 text-amber-500" /></div>
              <div><p className="text-2xl font-bold">{stats.emExecucao}</p><p className="text-xs text-muted-foreground">Em Execução</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-2xl font-bold text-destructive">{stats.atrasadas}</p><p className="text-xs text-muted-foreground">Atrasadas</p></div>
            </div>
          </CardContent>
        </Card>
        {stats.recusadas > 0 && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-400/50" onClick={() => filters.setAceiteFilter("recusado")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10"><XCircle className="h-5 w-5 text-red-500" /></div>
                <div><p className="text-2xl font-bold text-red-600">{stats.recusadas}</p><p className="text-xs text-muted-foreground">Recusadas</p></div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => filters.setStatusFilter("concluida")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle2 className="h-5 w-5 text-green-500" /></div>
              <div><p className="text-2xl font-bold">{stats.concluidas}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por OS, título, cliente ou usina..." value={filters.searchTerm} onChange={(e) => filters.setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filters.statusFilter} onValueChange={filters.setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="aberta">Abertas</SelectItem>
                <SelectItem value="em_execucao">Em Execução</SelectItem>
                <SelectItem value="concluida">Concluídas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.aceiteFilter} onValueChange={filters.setAceiteFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Aceite" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos aceites</SelectItem>
                <SelectItem value="pendente">Aguardando Aceite</SelectItem>
                <SelectItem value="aceito">Aceita</SelectItem>
                <SelectItem value="recusado">Recusada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.clienteFilter} onValueChange={filters.setClienteFilter}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.empresa || c.id}>{c.empresa || "Sem nome"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ufvSolarzOptions.length > 0 && (
              <Select value={filters.ufvSolarzFilter} onValueChange={filters.setUfvSolarzFilter}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="UFV/SolarZ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos UFV/SolarZ</SelectItem>
                  {ufvSolarzOptions.map((ufv) => (
                    <SelectItem key={ufv} value={ufv}>{ufv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Calendar className="h-4 w-4 mr-2" />
                  {filters.dateRange.from
                    ? filters.dateRange.to
                      ? `${format(filters.dateRange.from, "dd/MM")} - ${format(filters.dateRange.to, "dd/MM")}`
                      : format(filters.dateRange.from, "dd/MM/yyyy")
                    : "Período"}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{ from: filters.dateRange.from, to: filters.dateRange.to }}
                  onSelect={(range) => filters.setDateRange({ from: range?.from, to: range?.to })}
                  locale={ptBR}
                />
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => filters.setDateRange({})}>Limpar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* OS List */}
      {filters.filteredOrders.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma ordem de serviço encontrada" description="Ajuste os filtros ou crie uma nova OS" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filters.paginatedOrders.map((os) => {
              const status = getOSStatus(os);
              const config = statusConfig[status];
              const StatusIcon = config.icon;
              const prioridade = prioridadeConfig[os.tickets.prioridade] || prioridadeConfig.media;
              const isAtrasada = os.data_programada && new Date(os.data_programada) < new Date() && !["concluida", "cancelada"].includes(status);

              return (
                <Card
                  key={os.id}
                  className={`cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 ${
                    os.aceite_tecnico === "recusado" ? "border-red-400 bg-red-50/30 dark:bg-red-950/10" :
                    isAtrasada ? "border-destructive/50" : ""
                  }`}
                  onClick={() => navigate(`/work-orders/${os.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-semibold truncate">{os.numero_os}</CardTitle>
                          {isAtrasada && <Badge variant="destructive" className="text-[10px] px-1.5">ATRASADA</Badge>}
                          {os.aceite_tecnico === "recusado" && (
                            <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px] px-1.5">
                              <XCircle className="h-3 w-3 mr-0.5" />RECUSADA
                            </Badge>
                          )}
                          {os.aceite_tecnico === "pendente" && status === "aberta" && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5">
                              <Clock className="h-3 w-3 mr-0.5" />AGUARDANDO
                            </Badge>
                          )}
                          {os.aceite_tecnico === "aceito" && (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1.5">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />ACEITA
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{os.tickets.titulo}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge className={`${config.color} border text-xs`}>
                          <StatusIcon className="h-3 w-3 mr-1" />{config.label}
                        </Badge>
                        <Badge className={`${prioridade.color} text-[10px]`}>{prioridade.label}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{os.tickets.clientes?.empresa || "Cliente"}</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                          <Star className="h-3 w-3" />P{os.tickets.clientes?.prioridade ?? 5}
                        </Badge>
                        {os.tickets.clientes?.ufv_solarz && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs ml-1">{os.tickets.clientes.ufv_solarz}</Badge>
                        )}
                      </div>
                      {os.site_name && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 flex-shrink-0" /><span className="truncate">{os.site_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>
                          {os.data_programada ? format(new Date(os.data_programada), "dd/MM/yyyy", { locale: ptBR }) : "Sem data"}
                          {os.hora_inicio && ` às ${os.hora_inicio}`}
                        </span>
                      </div>
                    </div>
                    {os.aceite_tecnico === "recusado" && os.motivo_recusa && (
                      <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
                        <div className="flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <div><span className="font-medium">Motivo da recusa: </span><span className="line-clamp-2">{os.motivo_recusa}</span></div>
                        </div>
                      </div>
                    )}
                    {os.work_type && os.work_type.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {os.work_type.slice(0, 3).map((tipo) => (
                          <Badge key={tipo} variant="outline" className="text-[10px]">{tipo.toUpperCase()}</Badge>
                        ))}
                        {os.work_type.length > 3 && <Badge variant="outline" className="text-[10px]">+{os.work_type.length - 3}</Badge>}
                      </div>
                    )}
                    <div className="pt-2 border-t flex items-center justify-between">
                      <div>
                        {hasRME(os) ? (
                          <Badge className={isRMECompleted(os) ? "bg-green-500/10 text-green-600 border-green-200" : "bg-amber-500/10 text-amber-600 border-amber-200"}>
                            RME: {isRMECompleted(os) ? "Concluído" : "Rascunho"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Sem RME</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {canManageOS && (
                          <Button size="sm" variant="outline" className="h-7 px-2" disabled={sendingEmailId === os.id} onClick={(e) => handleSendEmail(e, os.id)}>
                            {sendingEmailId === os.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1" />}Email
                          </Button>
                        )}
                        {canManageOS && status === "aberta" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="h-7 px-2" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja excluir a OS {os.numero_os}? O ticket será revertido para "aprovado".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={(e) => handleDeleteOS(e, os.id, os.tickets.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination
            currentPage={filters.currentPage}
            totalPages={filters.totalPages}
            onPageChange={filters.setCurrentPage}
            totalItems={filters.filteredOrders.length}
            itemsPerPage={18}
          />
        </div>
      )}
    </div>
  );
};

export default WorkOrders;
