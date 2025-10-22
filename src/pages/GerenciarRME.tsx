import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, Search, Eye, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { RMEDetailDialog } from '@/components/RMEDetailDialog';
import { ApprovalModal } from '@/components/ApprovalModal';
import { useRMEApprovals } from '@/hooks/useRMEApprovals';
import { useTicketsRealtime } from '@/hooks/useTicketsRealtime';

const GerenciarRME = () => {
  const [rmes, setRmes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pendente');
  const [selectedRME, setSelectedRME] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalType, setApprovalType] = useState<'approve' | 'reject'>('approve');

  const { profile } = useAuth();
  const { toast } = useToast();
  const { approveRME, rejectRME, loading: approvalLoading } = useRMEApprovals();

  const loadRMEs = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('rme_relatorios')
        .select(`
          *,
          tickets!inner(
            titulo,
            numero_ticket,
            clientes!inner(empresa)
          ),
          tecnicos!inner(
            profiles!inner(nome)
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status_aprovacao', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRmes(data || []);
    } catch (error) {
      console.error('Erro ao carregar RMEs:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar RMEs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useTicketsRealtime({ onTicketChange: loadRMEs });

  useEffect(() => {
    loadRMEs();
  }, [statusFilter]);

  const handleViewDetails = (rme: any) => {
    setSelectedRME(rme);
    setDetailDialogOpen(true);
  };

  const handleApproveClick = (rme: any) => {
    setSelectedRME(rme);
    setApprovalType('approve');
    setApprovalModalOpen(true);
  };

  const handleRejectClick = (rme: any) => {
    setSelectedRME(rme);
    setApprovalType('reject');
    setApprovalModalOpen(true);
  };

  const handleApprovalConfirm = async (observacoes?: string) => {
    if (!selectedRME) return;

    const success =
      approvalType === 'approve'
        ? await approveRME(selectedRME.id, observacoes)
        : await rejectRME(selectedRME.id, observacoes || '');

    if (success) {
      setApprovalModalOpen(false);
      setSelectedRME(null);
      loadRMEs();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: any; icon: any }> = {
      pendente: { label: 'Pendente', variant: 'outline', icon: Clock },
      aprovado: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
      rejeitado: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || variants.pendente;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredRMEs = rmes.filter((rme) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      rme.tickets?.titulo?.toLowerCase().includes(searchLower) ||
      rme.tickets?.numero_ticket?.toLowerCase().includes(searchLower) ||
      rme.tickets?.clientes?.empresa?.toLowerCase().includes(searchLower) ||
      rme.tecnicos?.profiles?.nome?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    pendentes: rmes.filter((r) => r.status_aprovacao === 'pendente').length,
    aprovados: rmes.filter((r) => r.status_aprovacao === 'aprovado').length,
    rejeitados: rmes.filter((r) => r.status_aprovacao === 'rejeitado').length,
  };

  if (profile?.role !== 'admin' && profile?.role !== 'area_tecnica') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Esta página é exclusiva para administradores e área técnica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar RMEs</h1>
          <p className="text-muted-foreground">Aprovar ou rejeitar relatórios técnicos</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendentes}</div>
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.aprovados}</div>
            <p className="text-xs text-muted-foreground">RMEs aprovados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitados</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejeitados}</div>
            <p className="text-xs text-muted-foreground">RMEs rejeitados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ticket, cliente ou técnico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de RMEs */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      ) : filteredRMEs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Nenhum RME encontrado com os filtros selecionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRMEs.map((rme) => (
            <Card key={rme.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">
                        {rme.tickets?.numero_ticket} - {rme.tickets?.titulo}
                      </CardTitle>
                      {getStatusBadge(rme.status_aprovacao)}
                    </div>
                    <CardDescription>
                      <div className="space-y-1">
                        <div>
                          <strong>Cliente:</strong> {rme.tickets?.clientes?.empresa}
                        </div>
                        <div>
                          <strong>Técnico:</strong> {rme.tecnicos?.profiles?.nome}
                        </div>
                        <div>
                          <strong>Data de Execução:</strong>{' '}
                          {format(new Date(rme.data_execucao), 'dd/MM/yyyy')}
                        </div>
                        <div>
                          <strong>Preenchido em:</strong>{' '}
                          {format(new Date(rme.created_at), 'dd/MM/yyyy HH:mm')}
                        </div>
                        {rme.data_aprovacao && (
                          <div>
                            <strong>
                              {rme.status_aprovacao === 'aprovado' ? 'Aprovado' : 'Rejeitado'} em:
                            </strong>{' '}
                            {format(new Date(rme.data_aprovacao), 'dd/MM/yyyy HH:mm')}
                            {rme.aprovador && ` por ${rme.aprovador.nome}`}
                          </div>
                        )}
                        {rme.observacoes_aprovacao && (
                          <div>
                            <strong>Observações:</strong> {rme.observacoes_aprovacao}
                          </div>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(rme)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Ver Detalhes
                  </Button>
                  {rme.pdf_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(rme.pdf_url, '_blank')}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      PDF
                    </Button>
                  )}
                  {rme.status_aprovacao === 'pendente' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApproveClick(rme)}
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRejectClick(rme)}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <RMEDetailDialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedRME(null);
        }}
        rme={selectedRME}
      />

      <ApprovalModal
        open={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setSelectedRME(null);
        }}
        onConfirm={handleApprovalConfirm}
        type={approvalType}
        loading={approvalLoading}
      />
    </div>
  );
};

export default GerenciarRME;
