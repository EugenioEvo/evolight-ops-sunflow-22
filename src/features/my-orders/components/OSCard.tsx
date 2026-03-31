import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Eye, Calendar, MapPin, User, Play, Edit, Phone, Navigation, AlertCircle, CheckCircle2, ThumbsUp, ThumbsDown, Hourglass } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { OrdemServico } from "../types";

interface OSCardProps {
  os: OrdemServico;
  isTecnico: boolean;
  startingId: string | null;
  navigating: string | null;
  aceiteLoading: boolean;
  onIniciarExecucao: (os: OrdemServico) => void;
  onPreencherRME: (os: OrdemServico) => void;
  onVerOS: (os: OrdemServico) => void;
  onLigarCliente: (telefone?: string) => void;
  onAbrirMapa: (endereco: string) => void;
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
  const labels: Record<string, { label: string; variant: any }> = {
    'ordem_servico_gerada': { label: 'Pendente', variant: 'outline' },
    'em_execucao': { label: 'Em Execução', variant: 'default' },
    'concluido': { label: 'Concluído', variant: 'secondary' },
  };
  return labels[status] || { label: status, variant: 'outline' };
};

export function OSCard({
  os, isTecnico, startingId, navigating, aceiteLoading,
  onIniciarExecucao, onPreencherRME, onVerOS, onLigarCliente, onAbrirMapa, onAceitarOS, onRecusarOS,
}: OSCardProps) {
  const statusBadge = getStatusBadge(os.tickets.status);
  const isPendente = os.tickets.status === 'ordem_servico_gerada';
  const emExecucao = os.tickets.status === 'em_execucao';
  const aceite = os.aceite_tecnico || 'pendente';
  const aguardandoAceite = isPendente && aceite === 'pendente';
  const aceito = aceite === 'aceito';
  const recusado = aceite === 'recusado';

  return (
    <Card className={`hover:shadow-lg transition-shadow ${recusado && isPendente ? 'border-amber-300 bg-amber-50/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">{os.numero_os}</span>
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">{os.tickets.numero_ticket}</Badge>
              {aguardandoAceite && (
                <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">Aguardando Aceite</Badge>
              )}
              {aceito && isPendente && (
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

        {/* Accept/reject buttons */}
        {aguardandoAceite && isTecnico && (
          <div className="space-y-2">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                Você precisa aceitar ou recusar esta OS antes de iniciar a execução.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={() => onAceitarOS(os)} className="flex-1" disabled={aceiteLoading}>
                {aceiteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                Aceitar
              </Button>
              <Button onClick={() => onRecusarOS(os)} variant="destructive" className="flex-1" disabled={aceiteLoading}>
                <ThumbsDown className="h-4 w-4 mr-2" />Recusar
              </Button>
            </div>
          </div>
        )}

        {/* Main action buttons */}
        <div className="space-y-2">
          {isPendente && (aceito || !isTecnico) && !recusado && (
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

          {emExecucao && (
            <Button onClick={() => onPreencherRME(os)} className="w-full" disabled={navigating === os.id}>
              {navigating === os.id ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando RME...</>
              ) : (
                <><Edit className="h-4 w-4 mr-2" />Preencher RME</>
              )}
            </Button>
          )}

          {isPendente && aceito && (
            <Badge variant="outline" className="w-full justify-center py-2 bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />Aceita — Próximo: Iniciar Execução
            </Badge>
          )}

          {emExecucao && (
            <Badge variant="default" className="w-full justify-center py-2">
              <Edit className="h-3 w-3 mr-1" />Próximo: Preencher RME
            </Badge>
          )}

          <Button onClick={() => onVerOS(os)} variant="outline" className="w-full">
            <Eye className="h-4 w-4 mr-2" />Ver OS em PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
