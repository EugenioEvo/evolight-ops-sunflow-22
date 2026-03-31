import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Clock, MapPin, Settings, FileText, CheckCircle, XCircle, Download, Eye, Loader2, RefreshCw, Star, AlertTriangle, type LucideIcon } from 'lucide-react';
import { STATUS_COLORS, PRIORIDADE_COLORS } from '../types';
import type { TicketWithRelations, TicketPrestador } from '../types';
import { ticketService } from '../services/ticketService';
import { useToast } from '@/hooks/use-toast';

interface TicketCardProps {
  ticket: TicketWithRelations;
  profile: { role?: string } | null;
  prestadores: TicketPrestador[];
  loading: boolean;
  generatingOsId: string | null;
  reprocessingTicketId: string | null;
  geocoding: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (ticket: TicketWithRelations) => void;
  onDelete: (id: string) => void;
  onAssignTechnician: (ticketId: string, technicianId: string) => void;
  onGenerateOS: (ticket: TicketWithRelations) => void;
  onReprocessGeocode: (id: string, address: string) => void;
  getSortedPrestadores: (ticket?: TicketWithRelations) => TicketPrestador[];
  renderPrestadorOption: (prestador: TicketPrestador, index: number) => React.ReactNode;
}

export const TicketCard = ({
  ticket,
  profile,
  prestadores,
  loading,
  generatingOsId,
  reprocessingTicketId,
  geocoding,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onAssignTechnician,
  onGenerateOS,
  onReprocessGeocode,
  getSortedPrestadores,
  renderPrestadorOption,
}: TicketCardProps) => {
  const { toast } = useToast();
  const isStaff = profile?.role === 'admin' || profile?.role === 'engenharia' || profile?.role === 'supervisao';

  const handleViewOS = async () => {
    try {
      const os = ticket.ordens_servico?.[0];
      if (!os) {
        toast({ title: 'Aviso', description: 'OS não encontrada' });
        return;
      }
      if (os.pdf_url) {
        const signedUrl = await ticketService.getSignedPdfUrl(os.pdf_url);
        if (signedUrl) {
          window.open(signedUrl, '_blank');
        } else {
          toast({ title: 'Aviso', description: 'PDF ainda não disponível' });
        }
      } else {
        toast({ title: 'Aviso', description: 'PDF ainda não gerado' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro', description: 'Erro ao abrir OS: ' + message, variant: 'destructive' });
    }
  };

  const getGeocodingStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const config: Record<string, { variant: 'secondary' | 'destructive'; className: string; icon: LucideIcon; label: string; iconClass?: string }> = {
      'pending': { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock, label: 'Pendente' },
      'processing': { variant: 'secondary', className: 'bg-blue-100 text-blue-800 border-blue-300', icon: Loader2, label: 'Processando', iconClass: 'animate-spin' },
      'geocoded': { variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-300', icon: MapPin, label: 'Geocodificado' },
      'failed': { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, label: 'Falhou' },
    };
    const statusConfig = config[status];
    if (!statusConfig) return null;
    const Icon = statusConfig.icon;
    return (
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        <Icon className={`h-3 w-3 mr-1 ${statusConfig.iconClass || ''}`} />
        {statusConfig.label}
      </Badge>
    );
  };

  const DeleteButton = () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive">Excluir</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(ticket.id)}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{ticket.titulo}</CardTitle>
              <Badge variant="outline" className="text-xs">{ticket.numero_ticket}</Badge>
            </div>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <span>Cliente: {ticket.clientes?.empresa || ticket.clientes?.profiles?.nome}</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                <Star className="h-3 w-3" />P{ticket.clientes?.prioridade ?? 5}
              </Badge>
              {ticket.clientes?.ufv_solarz && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                  UFV/SolarZ: {ticket.clientes.ufv_solarz}
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}>
              {ticket.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge className={PRIORIDADE_COLORS[ticket.prioridade] || 'bg-gray-100 text-gray-800'}>
              {ticket.prioridade.toUpperCase()}
            </Badge>
            {getGeocodingStatusBadge(ticket.geocoding_status)}
            {(ticket.status === 'ordem_servico_gerada' || ticket.status === 'em_execucao' || ticket.status === 'concluido') && ticket.ordens_servico?.[0] && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <FileText className="h-3 w-3 mr-1" />{ticket.ordens_servico[0].numero_os}
              </Badge>
            )}
            {ticket.ordens_servico?.[0] && (
              <>
                {ticket.ordens_servico[0].aceite_tecnico === 'pendente' && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                    <Clock className="h-3 w-3 mr-1" />Aguardando Aceite
                  </Badge>
                )}
                {ticket.ordens_servico[0].aceite_tecnico === 'aceito' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />OS Aceita
                  </Badge>
                )}
                {ticket.ordens_servico[0].aceite_tecnico === 'recusado' && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                    <XCircle className="h-3 w-3 mr-1" />OS Recusada
                  </Badge>
                )}
              </>
            )}
            {ticket.status === 'aprovado' && ticket.ordens_servico?.[0]?.aceite_tecnico === 'recusado' && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />Retornou após recusa
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{ticket.descricao}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>{ticket.equipamento_tipo.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{ticket.endereco_servico}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{new Date(ticket.data_abertura).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {ticket.tempo_estimado && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>{ticket.tempo_estimado} horas estimadas</span>
            </div>
          )}

          {ticket.tecnico_responsavel_id && ticket.prestadores && (
            <p className="text-sm text-muted-foreground">
              <strong>Técnico:</strong> {ticket.prestadores.nome}
            </p>
          )}

          {ticket.latitude && ticket.longitude && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-green-600" />
              <span>Coordenadas: {Number(ticket.latitude).toFixed(6)}, {Number(ticket.longitude).toFixed(6)}</span>
            </div>
          )}

          {(ticket.geocoding_status === 'failed' || ticket.geocoding_status === 'pending' || !ticket.latitude || !ticket.longitude) && isStaff && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReprocessGeocode(ticket.id, ticket.endereco_servico)}
                disabled={reprocessingTicketId === ticket.id || geocoding}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {reprocessingTicketId === ticket.id ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Geocodificando...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />{ticket.geocoding_status === 'pending' ? 'Geocodificar' : 'Regeocodificar'}</>
                )}
              </Button>
            </div>
          )}

          {isStaff && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {ticket.status === 'aberto' && (
                <>
                  <Button size="sm" onClick={() => onApprove(ticket.id)} disabled={loading} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => onReject(ticket.id)} disabled={loading} className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />Rejeitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEdit(ticket)}>Editar</Button>
                  <DeleteButton />
                </>
              )}

              {ticket.status === 'aprovado' && !ticket.tecnico_responsavel_id && (
                <>
                  <Select onValueChange={(value) => onAssignTechnician(ticket.id, value)}>
                    <SelectTrigger className="h-8 w-[200px]">
                      <SelectValue placeholder="Atribuir técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSortedPrestadores(ticket).map((prestador, index) => renderPrestadorOption(prestador, index))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => onEdit(ticket)}>Editar</Button>
                  <DeleteButton />
                </>
              )}

              {ticket.status === 'aprovado' && ticket.tecnico_responsavel_id && (
                <>
                  <Select onValueChange={(value) => onAssignTechnician(ticket.id, value)} defaultValue={ticket.tecnico_responsavel_id}>
                    <SelectTrigger className="h-8 w-[200px]">
                      <SelectValue placeholder="Trocar técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSortedPrestadores(ticket).map((prestador, index) => renderPrestadorOption(prestador, index))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => onGenerateOS(ticket)} className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />Gerar Ordem de Serviço
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEdit(ticket)}>Editar</Button>
                  <DeleteButton />
                </>
              )}

              {(ticket.status === 'ordem_servico_gerada' || ticket.status === 'em_execucao') && (
                <Select onValueChange={(value) => onAssignTechnician(ticket.id, value)} defaultValue={ticket.tecnico_responsavel_id || undefined}>
                  <SelectTrigger className="h-8 w-[200px]">
                    <SelectValue placeholder="Trocar técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSortedPrestadores(ticket).map((prestador, index) => renderPrestadorOption(prestador, index))}
                  </SelectContent>
                </Select>
              )}

              {(ticket.status === 'ordem_servico_gerada' || ticket.status === 'em_execucao' || ticket.status === 'concluido') && (
                <>
                  <Button size="sm" variant="default" onClick={handleViewOS}>
                    <Eye className="h-4 w-4 mr-1" />Ver OS {ticket.ordens_servico?.[0]?.numero_os}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEdit(ticket)}>Editar</Button>
                  <DeleteButton />
                </>
              )}

              {(ticket.status === 'rejeitado' || ticket.status === 'cancelado') && <DeleteButton />}
            </div>
          )}

          {!isStaff && (
            <div className="flex justify-end pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Criado em {new Date(ticket.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
