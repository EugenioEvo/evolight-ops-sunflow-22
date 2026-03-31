import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGeocoding } from '@/hooks/useGeocoding';
import { useTechnicianScoreEngine } from '@/hooks/useTechnicianScore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Ticket as TicketIcon, AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { MultiTechnicianOSDialog } from '@/components/MultiTechnicianOSDialog';
import {
  useTicketData,
  useTicketMutations,
  useTicketFilters,
  TicketForm,
  TicketCard,
  ITEMS_PER_PAGE,
} from '@/features/tickets';

const Tickets = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [multiOSDialogTicket, setMultiOSDialogTicket] = useState<any>(null);

  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { geocodeAddress, loading: geocoding } = useGeocoding();

  const { tickets, clientes, prestadores, loading: dataLoading, loadData, ufvSolarzOptions, ufvSolarzListForForm } = useTicketData();
  const mutations = useTicketMutations(loadData);
  const filters = useTicketFilters(tickets);

  const { getScoresForTicket } = useTechnicianScoreEngine(prestadores);
  const activeTicketScoresRef = useRef<Map<string, any>>(new Map());

  const getSortedPrestadores = (ticket?: any) => {
    const scores = getScoresForTicket(ticket);
    const scoreMap = new Map(scores.map(s => [s.prestadorId, s]));
    activeTicketScoresRef.current = scoreMap;
    return [...prestadores].sort((a, b) => {
      const scoreA = scoreMap.get(a.id)?.score ?? 0;
      const scoreB = scoreMap.get(b.id)?.score ?? 0;
      return scoreB - scoreA;
    });
  };

  const renderPrestadorOption = (prestador: any, index: number) => {
    const scoreData = activeTicketScoresRef.current.get(prestador.id);
    const hasEmail = prestador.email && prestador.email.trim() !== '';
    return (
      <SelectItem key={prestador.id} value={prestador.id}>
        <div className="flex items-center gap-2 w-full">
          <span className={!hasEmail ? 'text-destructive' : ''}>{prestador.nome}</span>
          {!hasEmail && <AlertTriangle className="h-3 w-3 text-destructive" />}
          {scoreData && scoreData.score > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
              ⭐ {scoreData.score}%
            </Badge>
          )}
          {index === 0 && scoreData && scoreData.score >= 60 && (
            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 border-green-300">
              Recomendado
            </Badge>
          )}
        </div>
      </SelectItem>
    );
  };

  const handleEdit = (ticket: any) => {
    setEditingTicket(ticket);
    setIsDialogOpen(true);
  };

  const handleReprocessGeocode = async (ticketId: string, address: string) => {
    mutations.setReprocessingTicketId(ticketId);
    try {
      const result = await geocodeAddress(address, ticketId, true);
      if (result) {
        toast({
          title: 'Sucesso',
          description: `Endereço geocodificado: ${result.latitude?.toFixed(5)}, ${result.longitude?.toFixed(5)}`,
        });
        loadData();
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao geocodificar endereço', variant: 'destructive' });
    } finally {
      mutations.setReprocessingTicketId(null);
    }
  };

  const handleFormSubmit = async (data: any, technicianId: string | null, attachments: string[]) => {
    if (editingTicket) {
      await mutations.updateTicket(editingTicket, data, technicianId, attachments);
    } else {
      await mutations.createTicket(data, technicianId, attachments);
    }
    setEditingTicket(null);
  };

  if (dataLoading && tickets.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">Gerencie solicitações de manutenção</p>
        </div>
        <Button onClick={() => { setEditingTicket(null); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={filters.searchTerm}
            onChange={(e) => filters.setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs value={filters.activeTab} onValueChange={filters.setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="todos">Todos ({tickets.length})</TabsTrigger>
          <TabsTrigger value="aberto">Abertos ({tickets.filter(t => t.status === 'aberto').length})</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados ({tickets.filter(t => t.status === 'aprovado').length})</TabsTrigger>
          <TabsTrigger value="ordem_servico_gerada">OS Gerada ({tickets.filter(t => t.status === 'ordem_servico_gerada').length})</TabsTrigger>
          <TabsTrigger value="em_execucao">Em Execução ({tickets.filter(t => t.status === 'em_execucao').length})</TabsTrigger>
          <TabsTrigger value="concluido">Concluídos ({tickets.filter(t => t.status === 'concluido').length})</TabsTrigger>
          <TabsTrigger value="cancelado">Cancelados ({tickets.filter(t => t.status === 'cancelado').length})</TabsTrigger>
        </TabsList>

        <TabsContent value={filters.activeTab} className="space-y-4">
          {filters.filteredTickets.length === 0 ? (
            <EmptyState
              icon={TicketIcon}
              title="Nenhum ticket encontrado"
              description={filters.debouncedSearchTerm ? 'Tente ajustar os filtros de busca' : 'Crie seu primeiro ticket para começar'}
              actionLabel={!filters.debouncedSearchTerm ? "Criar Ticket" : undefined}
              onAction={!filters.debouncedSearchTerm ? () => setIsDialogOpen(true) : undefined}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                {filters.paginatedTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    profile={profile}
                    prestadores={prestadores}
                    loading={mutations.loading}
                    generatingOsId={mutations.generatingOsId}
                    reprocessingTicketId={mutations.reprocessingTicketId}
                    geocoding={geocoding}
                    onApprove={(id) => { mutations.approveTicket(id); filters.setActiveTab('aprovado'); }}
                    onReject={(id) => { mutations.rejectTicket(id); filters.setActiveTab('todos'); }}
                    onEdit={handleEdit}
                    onDelete={(id) => { mutations.deleteTicket(id); filters.setActiveTab('todos'); }}
                    onAssignTechnician={(ticketId, techId) => mutations.assignTechnician(ticketId, techId, tickets, prestadores)}
                    onGenerateOS={(ticket) => setMultiOSDialogTicket(ticket)}
                    onReprocessGeocode={handleReprocessGeocode}
                    getSortedPrestadores={getSortedPrestadores}
                    renderPrestadorOption={renderPrestadorOption}
                  />
                ))}
              </div>
              <Pagination
                currentPage={filters.currentPage}
                totalPages={filters.totalPages}
                onPageChange={filters.setCurrentPage}
                totalItems={filters.filteredTickets.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TicketForm
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingTicket(null); }}
        editingTicket={editingTicket}
        clientes={clientes}
        prestadores={prestadores}
        ufvSolarzListForForm={ufvSolarzListForForm}
        loading={mutations.loading}
        onSubmit={handleFormSubmit}
      />

      <MultiTechnicianOSDialog
        open={!!multiOSDialogTicket}
        onOpenChange={(open) => { if (!open) setMultiOSDialogTicket(null); }}
        ticketId={multiOSDialogTicket?.id || ''}
        ticket={multiOSDialogTicket}
        prestadores={prestadores.filter((p: any) => p.email && p.email.trim() !== '')}
        onSuccess={() => {
          filters.setActiveTab('ordem_servico_gerada');
          loadData();
        }}
      />
    </div>
  );
};

export default Tickets;
