import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Eye, Calendar, MapPin, User, Play, Edit, Phone, Navigation, AlertCircle, CheckCircle2, ThumbsUp, ThumbsDown, Hourglass, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OrdemServico } from "../types";

interface OSCardProps {
  os: OrdemServico;
  isTecnico: boolean;
  startingId: string | null;
  navigating: string | null;
  exportingRMEId?: string | null;
  aceiteLoading: boolean;
  onIniciarExecucao: (os: OrdemServico) => void;
  onPreencherRME: (os: OrdemServico) => void;
  onVerOS: (os: OrdemServico) => void;
  onVerRMEPDF?: (os: OrdemServico) => void;
  onLigarCliente: (telefone?: string) => void;
  onAbrirMapa: (endereco: string) => void;
  onAceitarTicket: (os: OrdemServico) => void;
  onAceitarOS: (os: OrdemServico) => void;
  onRecusarOS: (os: OrdemServico) => void;
}

const getPrioridadeColor = (prioridade: string) => {
  switch (prioridade) {
    case "critica": return "destructive";
    case "alta": return "default";
    case "media": return "secondary";
    case "baixa": return "outline";
    default: return "outline";
  }
};

const getStatusBadge = (status: string) => {
  const labels: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
    'ordem_servico_gerada': { label: 'Pendente', variant: 'outline' },
    'em_execucao': { label: 'Em Execução', variant: 'default' },
    'aguardando_rme': { label: 'Aguardando RME', variant: 'secondary' },
    'concluido': { label: 'Concluído', variant: 'secondary' },
  };
  return labels[status] || { label: status, variant: 'outline' };
};

export function OSCard({
  os, isTecnico, startingId, navigating, exportingRMEId, aceiteLoading,
  onIniciarExecucao, onPreencherRME, onVerOS, onVerRMEPDF, onLigarCliente, onAbrirMapa, onAceitarTicket, onAceitarOS, onRecusarOS,
}: OSCardProps) {
  const rme = os.rme_relatorios?.[0];
  const rmeStatus = rme?.status;
  // Reflect RME state in the OS badge: em_execucao + RME submitted (pendente/aprovado/rejeitado) => Aguardando RME
  const effectiveStatus =
    os.tickets.status === 'em_execucao' && rme && rmeStatus !== 'rascunho' && rmeStatus !== 'aprovado'
      ? 'aguardando_rme'
      : os.tickets.status;
  const statusBadge = getStatusBadge(effectiveStatus);
  const isPendente = os.tickets.status === 'ordem_servico_gerada' ||
    (os.tickets.status === 'aprovado' && os.aceite_tecnico === 'pendente');
  const emExecucao = os.tickets.status === 'em_execucao';
  const osAceite = os.aceite_tecnico || 'pendente';
  const ticketAceite = (os.tickets as any).aceite_tecnico || 'nao_aplicavel';

  // Two-step acceptance: ticket first, then OS
  const aguardandoAceiteTicket = ticketAceite === 'pendente' && isTecnico;
  const ticketAceito = ticketAceite === 'aceito' || ticketAceite === 'nao_aplicavel';
  const aguardandoAceiteOS = isPendente && osAceite === 'pendente' && ticketAceito;
  const osAceito = osAceite === 'aceito';
  const recusado = osAceite === 'recusado';

  return (
    <Card className={`hover:shadow-lg transition-shadow ${recusado && isPendente ? 'border-amber-300 bg-amber-50/50' : ''} ${aguardandoAceiteTicket ? 'border-blue-300 bg-blue-50/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">{os.numero_os}</span>
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">{os.tickets.numero_ticket}</Badge>
              {aguardandoAceiteTicket && (
                <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                  <ClipboardCheck className="h-3 w-3 mr-1" />Aceitar Atribuição
                </Badge>
              )}
              {ticketAceito && aguardandoAceiteOS && (
                <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">Aguardando Aceite OS</Badge>
              )}
              {osAceito && isPendente && (
                <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />Aceita
                </Badge>
              )}
              {recusado && isPendente && (
                <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                  <Hourglass className="h-3 w-3 mr-1" />Aguardando Resposta da Gestão
                </Badge>
              )}
            </div>
          </div>
          {!(recusado && isPendente) && (
            <div className="flex flex-col gap-1 items-end flex-shrink-0">
              <Badge variant={getPrioridadeColor(os.tickets.prioridade) as any} className="text-xs">{os.tickets.prioridade}</Badge>
              <Badge variant={statusBadge.variant as any} className="text-xs">{statusBadge.label}</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recusado && isPendente && (
          <Alert className="border-amber-300 bg-amber-100/60">
            <Hourglass className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-900 text-xs space-y-1">
              <p className="font-semibold text-sm">OS Recusada — Aguardando Resposta da Gestão</p>
              {os.motivo_recusa && <p className="italic">Motivo: {os.motivo_recusa}</p>}
            </AlertDescription>
          </Alert>
        )}
        <div>
          <h4 className="font-medium text-sm mb-2">{os.tickets.titulo}</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1">{os.tickets.clientes?.empresa || 'Cliente não definido'}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{os.tickets.endereco_servico}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Emitida: {format(new Date(os.data_emissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          {os.data_programada && (
            <div className="flex items-center gap-2 text-primary font-medium">
              <Calendar className="h-4 w-4" />
              <span>
                Agendada: {format(new Date(os.data_programada), "dd/MM/yyyy", { locale: ptBR })}
                {os.hora_inicio && os.hora_fim && ` às ${os.hora_inicio} - ${os.hora_fim}`}
              </span>
              {new Date(os.data_programada).toDateString() === new Date().toDateString() && (
                <Badge variant="default" className="ml-2">HOJE</Badge>
              )}
            </div>
          )}
          {os.tickets.data_inicio_execucao && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Iniciada: {format(new Date(os.tickets.data_inicio_execucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onLigarCliente(os.tickets.clientes?.profiles?.telefone)} disabled={!os.tickets.clientes?.profiles?.telefone} className="flex-1">
            <Phone className="h-4 w-4 mr-1" />Ligar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAbrirMapa(os.tickets.endereco_servico)} className="flex-1">
            <Navigation className="h-4 w-4 mr-1" />Mapa
          </Button>
        </div>

        {/* Step 1: Accept ticket assignment (only on reassignment) */}
        {aguardandoAceiteTicket && (
          <div className="space-y-2">
            <Alert className="border-blue-200 bg-blue-50">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs">
                <p className="font-semibold">Etapa 1: Aceitar Atribuição do Ticket</p>
                <p>Você foi atribuído a este ticket. Aceite para prosseguir com o aceite da OS.</p>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={() => onAceitarTicket(os)} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={aceiteLoading}>
                {aceiteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                Aceitar Atribuição
              </Button>
              <Button onClick={() => onRecusarOS(os)} variant="destructive" className="flex-1" disabled={aceiteLoading}>
                <ThumbsDown className="h-4 w-4 mr-2" />Recusar
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Accept OS (after ticket accepted) */}
        {aguardandoAceiteOS && isTecnico && !aguardandoAceiteTicket && (
          <div className="space-y-2">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                <p className="font-semibold">Etapa 2: Aceitar Ordem de Serviço</p>
                <p>Aceite a OS para poder iniciar a execução.</p>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={() => onAceitarOS(os)} className="flex-1" disabled={aceiteLoading}>
                {aceiteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                Aceitar OS
              </Button>
              <Button onClick={() => onRecusarOS(os)} variant="destructive" className="flex-1" disabled={aceiteLoading}>
                <ThumbsDown className="h-4 w-4 mr-2" />Recusar
              </Button>
            </div>
          </div>
        )}

        {/* Main action buttons */}
        <div className="space-y-2">
          {isPendente && (osAceito || !isTecnico) && !recusado && ticketAceito && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => onIniciarExecucao(os)} className="w-full" disabled={startingId === os.id}>
                  {startingId === os.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Iniciando...</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" />Iniciar Execução</>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Inicie a execução para depois preencher o RME</p></TooltipContent>
            </Tooltip>
          )}

          {isPendente && osAceito && ticketAceito && (
            <>
              <Badge variant="outline" className="w-full justify-center py-2 bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />Aceita — Próximo: Iniciar Execução
              </Badge>
              {isTecnico && (
                <Button
                  onClick={() => onRecusarOS(os)}
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                  disabled={aceiteLoading}
                >
                  <ThumbsDown className="h-4 w-4 mr-2" />Cancelar aceite (devolver para gestão)
                </Button>
              )}
            </>
          )}

          {emExecucao && (() => {
            const rme = os.rme_relatorios?.[0];
            const rmeStatus = rme?.status;
            const isViewOnly = !!rme && rmeStatus !== 'rascunho';
            const buttonLabel = !rme
              ? 'Preencher RME'
              : rmeStatus === 'rascunho'
                ? 'Continuar RME'
                : rmeStatus === 'pendente'
                  ? 'Visualizar RME (Aguardando Aprovação)'
                  : rmeStatus === 'aprovado'
                    ? 'Visualizar RME (Aprovado)'
                    : 'Visualizar RME (Rejeitado)';
            const Icon = isViewOnly ? Eye : Edit;
            const nextLabel = !rme
              ? 'Próximo: Preencher RME'
              : rmeStatus === 'rascunho'
                ? 'Próximo: Concluir RME'
                : rmeStatus === 'pendente'
                  ? 'Aguardando aprovação do RME'
                  : rmeStatus === 'aprovado'
                    ? 'RME aprovado — OS em conclusão'
                    : 'RME rejeitado — revise com a gestão';
            return (
              <>
                <Button onClick={() => onPreencherRME(os)} className="w-full" disabled={navigating === os.id}>
                  {navigating === os.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando RME...</>
                  ) : (
                    <><Icon className="h-4 w-4 mr-2" />{buttonLabel}</>
                  )}
                </Button>
                <Badge variant="default" className="w-full justify-center py-2">
                  <Edit className="h-3 w-3 mr-1" />{nextLabel}
                </Badge>
              </>
            );
          })()}

          <Button onClick={() => onVerOS(os)} variant="outline" className="w-full">
            <Eye className="h-4 w-4 mr-2" />Ver OS em PDF
          </Button>

          {os.rme_relatorios?.[0] && os.rme_relatorios[0].status !== 'rascunho' && onVerRMEPDF && (
            <Button
              onClick={() => onVerRMEPDF(os)}
              variant="outline"
              className="w-full"
              disabled={exportingRMEId === os.id}
            >
              {exportingRMEId === os.id ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando RME...</>
              ) : (
                <><FileText className="h-4 w-4 mr-2" />Ver RME em PDF</>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
