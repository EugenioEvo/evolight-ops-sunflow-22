import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Ticket, Calendar, Clock, MapPin, FileText, AlertCircle, CheckCircle2, XCircle, Wrench,
  User, Building2, Mail, Phone, Sun, Hash, Plus, Pencil, Ban, ExternalLink, ClipboardList,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { useAuth } from '@/hooks/useAuth';
import { useClientDashData } from '@/features/client-dashboard';
import { ClientTicketDialog } from '@/features/client-dashboard/components/ClientTicketDialog';
import { ticketService } from '@/features/tickets/services/ticketService';

const TICKET_STATUS_COLOR: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-800 border-blue-200',
  aguardando_aprovacao: 'bg-amber-100 text-amber-800 border-amber-200',
  aprovado: 'bg-green-100 text-green-800 border-green-200',
  ordem_servico_gerada: 'bg-purple-100 text-purple-800 border-purple-200',
  em_execucao: 'bg-orange-100 text-orange-800 border-orange-200',
  aguardando_rme: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  concluido: 'bg-gray-100 text-gray-800 border-gray-200',
  rejeitado: 'bg-red-100 text-red-800 border-red-200',
  cancelado: 'bg-red-100 text-red-800 border-red-200',
};
const TICKET_STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', aguardando_aprovacao: 'Aguardando aprovação', aprovado: 'Aprovado',
  ordem_servico_gerada: 'OS Gerada', em_execucao: 'Em execução', aguardando_rme: 'Aguardando RME',
  concluido: 'Concluído', rejeitado: 'Rejeitado', cancelado: 'Cancelado',
};
const RME_STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado',
};
const RME_STATUS_COLOR: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-800 border-gray-200',
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  aprovado: 'bg-green-100 text-green-800 border-green-200',
  rejeitado: 'bg-red-100 text-red-800 border-red-200',
};
const ORIGEM_LABEL: Record<string, { label: string; className: string }> = {
  solarz: { label: 'SolarZ', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  conta_azul: { label: 'Conta Azul', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  manual: { label: 'Manual', className: 'bg-muted text-muted-foreground border-border' },
};
const OBRA_STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada', em_execucao: 'Em execução', pausada: 'Pausada',
  concluida: 'Concluída', cancelada: 'Cancelada',
};

const formatDateBR = (v?: string | null) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, cliente, tickets, rmes, ordensServico, obras, rdos, stats, refresh } = useClientDashData();
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const rdosByObra = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of rdos) {
      if (!r.obra_id) continue;
      (map[r.obra_id] ||= []).push(r);
    }
    return map;
  }, [rdos]);

  const rmesByTicket = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of rmes) {
      const tid = (r.tickets as any)?.id || r.ticket_id;
      if (!tid) continue;
      (map[tid] ||= []).push(r);
    }
    return map;
  }, [rmes]);

  if (loading) return <LoadingState />;

  if (!cliente) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertCircle} title="Perfil não encontrado" description="Não foi possível encontrar seus dados de cliente. Entre em contato com o suporte." />
      </div>
    );
  }

  const origemKey = (cliente.origem ?? 'manual').toLowerCase();
  const origemMeta = ORIGEM_LABEL[origemKey] ?? ORIGEM_LABEL.manual;
  const ufvs: any[] = cliente.cliente_ufvs || [];
  const contaAzulIds: any[] = cliente.cliente_conta_azul_ids || [];

  const canEditTicket = (t: any) =>
    t.created_by === user?.id && ['aberto', 'aguardando_aprovacao'].includes(t.status);
  const canCancelTicket = (t: any) =>
    t.created_by === user?.id && !['cancelado', 'concluido'].includes(t.status);

  const openNewTicket = () => { setEditingTicket(null); setTicketDialogOpen(true); };
  const openEditTicket = (t: any) => { setEditingTicket(t); setTicketDialogOpen(true); };

  const handleCancelTicket = async (t: any) => {
    const motivo = window.prompt(`Cancelar o chamado "${t.titulo}"? Informe o motivo (opcional):`, '');
    if (motivo === null) return;
    setCancellingId(t.id);
    try {
      await ticketService.cancel(t.id);
      toast.success('Chamado cancelado.');
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cancelar chamado');
    } finally {
      setCancellingId(null);
    }
  };

  const ticketRows = (filterFn?: (t: any) => boolean) => {
    const list = filterFn ? tickets.filter(filterFn) : tickets;
    if (list.length === 0) return <EmptyState icon={Ticket} title="Nenhum chamado" description="Você ainda não possui chamados nesta visão." />;
    return (
      <div className="grid gap-4">
        {list.map((t: any) => (
          <Card key={t.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-lg truncate">{t.titulo}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{t.numero_ticket}</Badge>
                    {t.ordens_servico?.[0]?.numero_os && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        <FileText className="h-3 w-3 mr-1" />{t.ordens_servico[0].numero_os}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <Badge className={TICKET_STATUS_COLOR[t.status] || 'bg-gray-100'}>
                  {TICKET_STATUS_LABEL[t.status] || t.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">{t.descricao}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{t.endereco_servico}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" /><span>Aberto em {formatDateBR(t.data_abertura)}</span>
                </div>
                {t.ufv_nome && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Sun className="h-4 w-4 shrink-0" /><span className="truncate">{t.ufv_nome}</span>
                  </div>
                )}
                {t.prestadores?.nome && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" /><span className="truncate">Técnico: {t.prestadores.nome}</span>
                  </div>
                )}
              </div>
              {(canEditTicket(t) || canCancelTicket(t)) && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                  {canEditTicket(t) && (
                    <Button size="sm" variant="outline" onClick={() => openEditTicket(t)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                  )}
                  {canCancelTicket(t) && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      disabled={cancellingId === t.id} onClick={() => handleCancelTicket(t)}>
                      <Ban className="h-3.5 w-3.5 mr-1" />{cancellingId === t.id ? 'Cancelando...' : 'Cancelar'}
                    </Button>
                  )}
                  {!canEditTicket(t) && t.created_by === user?.id && (
                    <span className="text-xs text-muted-foreground">Em atendimento — edição bloqueada.</span>
                  )}
                  {t.created_by !== user?.id && (
                    <span className="text-xs text-muted-foreground">Aberto pela equipe Evolight — somente leitura.</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">
            Meu Painel
          </h1>
          <p className="text-muted-foreground">Bem-vindo(a), {cliente.profiles?.nome || cliente.empresa}.</p>
        </div>
        <Button onClick={openNewTicket} className="min-h-11">
          <Plus className="h-4 w-4 mr-2" />Abrir chamado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de chamados', value: stats.total, icon: Ticket },
          { label: 'Em aberto', value: stats.abertos, icon: Clock, color: 'border-blue-200 bg-blue-50/50 text-blue-700' },
          { label: 'Em execução', value: stats.emExecucao, icon: Wrench, color: 'border-orange-200 bg-orange-50/50 text-orange-700' },
          { label: 'Concluídos', value: stats.concluidos, icon: CheckCircle2, color: 'border-green-200 bg-green-50/50 text-green-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className={color}>
            <CardHeader className="pb-2"><CardTitle className="text-xs md:text-sm font-medium">{label}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between pt-0">
              <p className="text-2xl md:text-3xl font-bold">{value}</p>
              <Icon className="h-7 w-7 opacity-50" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="om">O&amp;M</TabsTrigger>
          <TabsTrigger value="obras">Obras</TabsTrigger>
        </TabsList>

        {/* ============ RESUMO ============ */}
        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />Informações pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3"><User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{cliente.profiles?.nome || '—'}</p></div></div>
              <div className="flex items-start gap-3"><Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">E-mail</p><p className="font-medium break-all">{cliente.profiles?.email || '—'}</p></div></div>
              <div className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{cliente.profiles?.telefone || '—'}</p></div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Dados da conta</CardTitle>
                <Badge variant="outline" className={origemMeta.className}>Origem: {origemMeta.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Empresa</p><p className="font-medium">{cliente.empresa || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">CNPJ / CPF</p><p className="font-medium">{cliente.cnpj_cpf || '—'}</p></div>
              <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Endereço</p>
                <p className="font-medium">{[cliente.endereco, cliente.cidade, cliente.estado, cliente.cep].filter(Boolean).join(', ') || '—'}</p></div>
              {cliente.solarz_customer_id && (
                <div><p className="text-xs text-muted-foreground">ID SolarZ</p><p className="font-medium">{cliente.solarz_customer_id}</p></div>
              )}
              {cliente.prioridade != null && (
                <div><p className="text-xs text-muted-foreground">Prioridade</p><p className="font-medium">P{cliente.prioridade}</p></div>
              )}
            </CardContent>
          </Card>

          {contaAzulIds.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Hash className="h-4 w-4 text-primary" />Vínculos Conta Azul</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {contaAzulIds.map((ca: any) => (
                  <div key={ca.id} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md border bg-card/50 text-sm">
                    <div className="space-y-0.5">
                      <p className="font-medium">{ca.nome_fiscal || '(sem nome fiscal)'}</p>
                      <p className="text-xs text-muted-foreground">{ca.cnpj_cpf || '—'}{ca.email ? ` · ${ca.email}` : ''}</p>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">{ca.conta_azul_customer_id}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sun className="h-4 w-4 text-primary" />Minhas UFVs</CardTitle></CardHeader>
            <CardContent>
              {ufvs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma UFV cadastrada.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ufvs.map((u: any) => (
                    <div key={u.id} className="p-3 rounded-md border bg-card/50 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{u.nome || `UFV ${u.solarz_ufv_id}`}</p>
                        {u.status && <Badge variant="outline" className="text-[10px]">{u.status}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{[u.endereco, u.cidade, u.estado].filter(Boolean).join(', ') || '—'}</p>
                      {u.potencia_kwp != null && <p className="text-xs text-muted-foreground">{u.potencia_kwp} kWp</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ O&M ============ */}
        <TabsContent value="om" className="space-y-4">
          <Tabs defaultValue="tickets" className="space-y-4">
            <TabsList>
              <TabsTrigger value="tickets">Chamados ({tickets.length})</TabsTrigger>
              <TabsTrigger value="os">Ordens de Serviço ({ordensServico.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="tickets" className="space-y-4">
              {ticketRows()}
            </TabsContent>
            <TabsContent value="os" className="space-y-4">
              {ordensServico.length === 0 ? (
                <EmptyState icon={FileText} title="Nenhuma OS" description="Ainda não há ordens de serviço para você." />
              ) : (
                <div className="grid gap-3">
                  {ordensServico.map((os: any) => {
                    const rmesOfTicket = rmesByTicket[os.tickets?.id] || [];
                    const myRme = rmesOfTicket.find((r: any) => r.ordens_servico?.numero_os === os.numero_os) || rmesOfTicket[0];
                    return (
                      <Card key={os.id}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />{os.numero_os}
                                <Badge variant="outline" className="text-xs">{os.tickets?.numero_ticket}</Badge>
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-1">{os.tickets?.titulo}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {os.aceite_tecnico && (
                                <Badge variant="outline" className="text-xs">
                                  Aceite: {os.aceite_tecnico}
                                </Badge>
                              )}
                              {myRme && (
                                <Badge variant="outline" className={`text-xs ${RME_STATUS_COLOR[myRme.status] || ''}`}>
                                  RME: {RME_STATUS_LABEL[myRme.status] || myRme.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDateBR(os.data_programada)}</div>
                            {os.hora_inicio && <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{os.hora_inicio}{os.hora_fim ? ` – ${os.hora_fim}` : ''}</div>}
                            {os.tecnicos?.profiles?.nome && <div className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{os.tecnicos.profiles.nome}</div>}
                          </div>
                          {(os.pdf_url || myRme) && (
                            <div className="flex flex-wrap gap-2 pt-1 border-t">
                              {os.pdf_url && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={os.pdf_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" />Ver OS (PDF)</a>
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ============ OBRAS ============ */}
        <TabsContent value="obras" className="space-y-4">
          {obras.length === 0 ? (
            <EmptyState icon={Building2} title="Nenhuma obra" description="Você ainda não possui obras vinculadas às suas UFVs." />
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {obras.map((o: any) => {
                const rdosOfObra = rdosByObra[o.id] || [];
                return (
                  <AccordionItem key={o.id} value={o.id} className="border rounded-md bg-card">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium truncate">{o.nome}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{OBRA_STATUS_LABEL[o.status] || o.status}</Badge>
                          <Badge variant="outline" className="text-xs"><ClipboardList className="h-3 w-3 mr-1" />{rdosOfObra.length} RDO(s)</Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-4 w-4 mt-0.5" />
                          <span>{[o.endereco, o.cidade, o.estado].filter(Boolean).join(', ') || '—'}</span></div>
                        {o.potencia_kwp != null && <div className="text-muted-foreground">Potência: <span className="text-foreground font-medium">{o.potencia_kwp} kWp</span></div>}
                        {o.data_inicio_prevista && <div className="text-muted-foreground">Início: <span className="text-foreground font-medium">{formatDateBR(o.data_inicio_prevista)}</span></div>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/portal/obras/${o.id}`)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir detalhes da obra
                      </Button>
                      {rdosOfObra.length > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          <p className="text-xs font-medium text-muted-foreground">RDOs recentes</p>
                          <ul className="divide-y">
                            {rdosOfObra.slice(0, 5).map((r: any) => (
                              <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span>{r.numero_rdo} — {formatDateBR(r.data_rdo)}</span>
                                <Badge variant="outline" className="text-xs">{r.status}</Badge>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>

      <ClientTicketDialog
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
        cliente={cliente}
        editingTicket={editingTicket}
        onSaved={refresh}
      />
    </div>
  );
};

// Suppress unused warnings for icons that may be conditionally rendered above.
void XCircle;

export default ClientDashboard;
