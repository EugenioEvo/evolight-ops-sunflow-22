import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Calendar, Clock, MapPin, Users, FileText, Download,
  PlayCircle, CheckCircle2, AlertTriangle, XCircle, Edit, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState } from "@/components/LoadingState";
import { generateOSPDF } from "@/utils/generateOSPDF";

interface WorkOrderDetail {
  id: string;
  numero_os: string;
  data_emissao: string;
  data_programada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  site_name: string | null;
  work_type: string[];
  servico_solicitado: string | null;
  inspetor_responsavel: string | null;
  equipe: string[] | null;
  notes: string | null;
  tickets: {
    id: string;
    titulo: string;
    descricao: string;
    status: string;
    prioridade: string;
    endereco_servico: string;
    clientes: {
      empresa: string;
      endereco: string;
      cidade: string;
      estado: string;
      ufv_solarz: string | null;
    };
  };
  rme_relatorios: Array<{
    id: string;
    status: string;
    created_at: string;
  }>;
}

const statusTimeline = [
  { key: "aberta", label: "Aberta", icon: FileText },
  { key: "em_execucao", label: "Em Execução", icon: PlayCircle },
  { key: "aguardando_rme", label: "Aguardando RME", icon: Clock },
  { key: "concluida", label: "Concluída", icon: CheckCircle2 },
];

const WorkOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);

  const canManageOS = profile?.role === "admin" || profile?.role === "area_tecnica";
  const canCreateRME = profile?.role === "tecnico_campo" || canManageOS;

  useEffect(() => {
    if (id) loadWorkOrder();
  }, [id]);

  const loadWorkOrder = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          tickets!inner(
            id, titulo, descricao, status, prioridade, endereco_servico,
            clientes(empresa, endereco, cidade, estado, ufv_solarz)
          ),
          rme_relatorios(id, status, created_at)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({
          title: "OS não encontrada",
          variant: "destructive",
        });
        navigate("/work-orders");
        return;
      }

      setWorkOrder({
        ...data,
        work_type: Array.isArray(data.work_type) ? data.work_type as string[] : [],
        rme_relatorios: Array.isArray(data.rme_relatorios) ? data.rme_relatorios : data.rme_relatorios ? [data.rme_relatorios] : [],
      } as WorkOrderDetail);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar OS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStatus = (): string => {
    if (!workOrder) return "aberta";
    const ticketStatus = workOrder.tickets.status;
    if (ticketStatus === "concluido") return "concluida";
    if (ticketStatus === "em_execucao") {
      // Se tem RME em rascunho
      if (workOrder.rme_relatorios.some(r => r.status === "rascunho")) {
        return "aguardando_rme";
      }
      return "em_execucao";
    }
    if (ticketStatus === "cancelado") return "cancelada";
    return "aberta";
  };

  const hasRME = workOrder?.rme_relatorios && workOrder.rme_relatorios.length > 0;
  const isRMECompleted = workOrder?.rme_relatorios?.some(r => r.status === "concluido");
  const currentStatus = getCurrentStatus();

  const handleStartExecution = async () => {
    if (!workOrder) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          status: "em_execucao",
          data_inicio_execucao: new Date().toISOString(),
        })
        .eq("id", workOrder.tickets.id);

      if (error) throw error;

      toast({ title: "Execução iniciada!" });
      loadWorkOrder();
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar execução",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteOS = async () => {
    if (!workOrder) return;

    // Validar RME concluído
    if (!isRMECompleted) {
      toast({
        title: "Não é possível concluir",
        description: "A OS só pode ser concluída quando houver um RME concluído vinculado.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          status: "concluido",
          data_conclusao: new Date().toISOString(),
        })
        .eq("id", workOrder.tickets.id);

      if (error) throw error;

      toast({ title: "OS concluída com sucesso!" });
      loadWorkOrder();
    } catch (error: any) {
      toast({
        title: "Erro ao concluir OS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!workOrder) return;
    try {
      const pdfData = {
        numero_os: workOrder.numero_os,
        data_programada: workOrder.data_programada || new Date().toISOString(),
        equipe: workOrder.equipe || ["Não informado"],
        cliente: workOrder.tickets.clientes?.empresa || "Não informado",
        endereco: `${workOrder.tickets.clientes?.endereco || ""}, ${workOrder.tickets.clientes?.cidade || ""} - ${workOrder.tickets.clientes?.estado || ""}`,
        servico_solicitado: workOrder.servico_solicitado || "MANUTENÇÃO",
        hora_marcada: workOrder.hora_inicio || "00:00",
        descricao: workOrder.tickets.descricao || workOrder.tickets.titulo,
        inspetor_responsavel: workOrder.inspetor_responsavel || "TODOS",
        tipo_trabalho: workOrder.work_type || [],
        ufv_solarz: workOrder.tickets.clientes?.ufv_solarz || undefined,
      };

      const pdfBlob = await generateOSPDF(pdfData);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OS_${workOrder.numero_os}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "PDF baixado!" });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateRME = () => {
    if (!workOrder) return;

    // Verificar se já existe RME
    if (hasRME) {
      const rme = workOrder.rme_relatorios[0];
      navigate(`/rme-wizard/${rme.id}`);
    } else {
      navigate(`/rme-wizard/new?os=${workOrder.id}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState variant="card" count={2} />
      </div>
    );
  }

  if (!workOrder) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in pb-32">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/work-orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{workOrder.numero_os}</h1>
              <Badge
                className={
                  currentStatus === "concluida"
                    ? "bg-green-500/10 text-green-600"
                    : currentStatus === "em_execucao" || currentStatus === "aguardando_rme"
                    ? "bg-amber-500/10 text-amber-600"
                    : currentStatus === "cancelada"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-blue-500/10 text-blue-600"
                }
              >
                {statusTimeline.find(s => s.key === currentStatus)?.label || currentStatus}
              </Badge>
            </div>
            <p className="text-muted-foreground">{workOrder.tickets.titulo}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleDownloadPDF}>
          <Download className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </div>

      {/* Timeline de Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status da OS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {statusTimeline.map((step, index) => {
              const StepIcon = step.icon;
              const statusIndex = statusTimeline.findIndex(s => s.key === currentStatus);
              const isCompleted = index < statusIndex;
              const isCurrent = index === statusIndex;
              const isPending = index > statusIndex;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${isCompleted ? "bg-green-500 text-white" : ""}
                        ${isCurrent ? "bg-primary text-primary-foreground" : ""}
                        ${isPending ? "bg-muted text-muted-foreground" : ""}
                      `}
                    >
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <span
                      className={`text-xs mt-2 text-center ${
                        isPending ? "text-muted-foreground" : "font-medium"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < statusTimeline.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        isCompleted ? "bg-green-500" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alerta de RME */}
      {currentStatus === "em_execucao" && !isRMECompleted && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>RME Pendente</AlertTitle>
          <AlertDescription>
            Para concluir esta OS, é necessário preencher e concluir o RME (Relatório de Manutenção Executada).
          </AlertDescription>
        </Alert>
      )}

      {/* Detalhes da OS */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Data Programada</p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {workOrder.data_programada
                      ? format(new Date(workOrder.data_programada), "dd/MM/yyyy", { locale: ptBR })
                      : "Não definida"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horário</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {workOrder.hora_inicio || "00:00"} - {workOrder.hora_fim || "00:00"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium mt-1">{workOrder.tickets.clientes?.empresa}</p>
              {workOrder.tickets.clientes?.ufv_solarz && (
                <Badge variant="outline" className="mt-1 bg-amber-50 text-amber-700 border-amber-200">
                  UFV/SolarZ: {workOrder.tickets.clientes.ufv_solarz}
                </Badge>
              )}
            </div>

            {workOrder.site_name && (
              <div>
                <p className="text-sm text-muted-foreground">Usina</p>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{workOrder.site_name}</span>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Endereço</p>
              <p className="font-medium mt-1">{workOrder.tickets.endereco_servico}</p>
            </div>
          </CardContent>
        </Card>

        {/* Serviço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Serviço Solicitado</p>
              <Badge className="mt-1">{workOrder.servico_solicitado?.toUpperCase() || "MANUTENÇÃO"}</Badge>
            </div>

            {workOrder.work_type && workOrder.work_type.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Tipo de Trabalho</p>
                <div className="flex flex-wrap gap-2">
                  {workOrder.work_type.map((tipo) => (
                    <Badge key={tipo} variant="outline">
                      {tipo.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Responsável</p>
              <div className="flex items-center gap-2 mt-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{workOrder.inspetor_responsavel || "Não definido"}</span>
              </div>
            </div>

            {workOrder.equipe && workOrder.equipe.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Equipe</p>
                <div className="flex flex-wrap gap-2">
                  {workOrder.equipe.map((membro) => (
                    <Badge key={membro} variant="secondary">
                      {membro}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {workOrder.tickets.descricao && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="mt-1 text-sm">{workOrder.tickets.descricao}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RME Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório de Manutenção (RME)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasRME ? (
            <div className="flex items-center justify-between">
              <div>
                <Badge
                  className={
                    isRMECompleted
                      ? "bg-green-500/10 text-green-600 border-green-200"
                      : "bg-amber-500/10 text-amber-600 border-amber-200"
                  }
                >
                  {isRMECompleted ? "RME Concluído" : "RME em Rascunho"}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Criado em{" "}
                  {format(new Date(workOrder.rme_relatorios[0].created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
              <Button onClick={handleCreateRME}>
                <Edit className="h-4 w-4 mr-2" />
                {isRMECompleted ? "Visualizar RME" : "Continuar RME"}
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">Nenhum RME criado para esta OS</p>
              {canCreateRME && currentStatus === "em_execucao" && (
                <Button onClick={handleCreateRME}>
                  <Edit className="h-4 w-4 mr-2" />
                  Criar RME
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer com Ações */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
        <div className="max-w-4xl mx-auto flex gap-3">
          {currentStatus === "aberta" && canManageOS && (
            <Button
              className="flex-1 h-12"
              onClick={handleStartExecution}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Iniciar Execução
            </Button>
          )}

          {currentStatus === "em_execucao" && canCreateRME && (
            <>
              <Button variant="outline" className="flex-1 h-12" onClick={handleCreateRME}>
                <Edit className="h-4 w-4 mr-2" />
                {hasRME ? "Editar RME" : "Criar RME"}
              </Button>
              {isRMECompleted && canManageOS && (
                <Button
                  className="flex-1 h-12"
                  onClick={handleCompleteOS}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Concluir OS
                </Button>
              )}
            </>
          )}

          {currentStatus === "concluida" && (
            <Button variant="outline" className="flex-1 h-12" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF da OS
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkOrderDetail;
