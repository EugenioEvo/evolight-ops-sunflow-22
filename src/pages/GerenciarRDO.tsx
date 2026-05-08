import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, XCircle, Clock, Search, Eye, FileSpreadsheet, FileDown } from 'lucide-react';
import { rdoService } from '@/features/rdo/services/rdoService';
import { downloadRDOPDF } from '@/utils/generateRDOPDF';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApprovalModal } from '@/components/ApprovalModal';
import { useRDOQuery, useRDOMutations, RDO_STATUS_LABEL, RDO_STATUS_VARIANT, type RDOStatus, type RDORelatorio } from '@/features/rdo';

export default function GerenciarRDO() {
  const navigate = useNavigate();
  const { data: rdos = [], isLoading } = useRDOQuery();
  const { approve, reject } = useRDOMutations();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pendente');
  const [selected, setSelected] = useState<RDORelatorio | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'approve' | 'reject'>('approve');

  const stats = useMemo(() => {
    const acc = { pendente: 0, aprovado: 0, rejeitado: 0, rascunho: 0 } as Record<RDOStatus, number>;
    for (const r of rdos) acc[r.status as RDOStatus] = (acc[r.status as RDOStatus] || 0) + 1;
    return acc;
  }, [rdos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rdos.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.numero_rdo, r.obra?.nome, r.responsavel?.nome, r.obra?.cidade]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rdos, search, statusFilter]);

  const handleConfirm = async (observacoes?: string) => {
    if (!selected) return;
    if (modalType === 'approve') {
      await approve.mutateAsync({ id: selected.id, observacoes });
    } else {
      await reject.mutateAsync({ id: selected.id, motivo: observacoes || '' });
    }
    setModalOpen(false);
    setSelected(null);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" /> Aprovar RDOs
        </h1>
        <p className="text-sm text-muted-foreground">Revise e decida sobre os RDOs enviados pelos supervisores.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.pendente || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.aprovado || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitados</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.rejeitado || 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, obra, cidade ou responsável…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="aprovado">Aprovados</SelectItem>
                <SelectItem value="rejeitado">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum RDO encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead className="hidden md:table-cell">Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.numero_rdo}</TableCell>
                      <TableCell className="text-sm">
                        {r.data_rdo ? format(new Date(r.data_rdo + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{r.obra?.nome ?? '—'}</div>
                        {r.obra?.cidade && (
                          <div className="text-xs text-muted-foreground">
                            {r.obra.cidade}{r.obra.estado ? `/${r.obra.estado}` : ''}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{r.responsavel?.nome ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={RDO_STATUS_VARIANT[r.status as RDOStatus] ?? 'secondary'}>
                          {RDO_STATUS_LABEL[r.status as RDOStatus] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/rdo/${r.id}`)} className="gap-1">
                            <Eye className="h-4 w-4" /> Ver
                          </Button>
                          {r.status === 'pendente' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => { setSelected(r); setModalType('approve'); setModalOpen(true); }}
                                className="gap-1"
                              >
                                <CheckCircle className="h-4 w-4" /> Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => { setSelected(r); setModalType('reject'); setModalOpen(true); }}
                                className="gap-1"
                              >
                                <XCircle className="h-4 w-4" /> Rejeitar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ApprovalModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onConfirm={handleConfirm}
        type={modalType}
        loading={approve.isPending || reject.isPending}
        entityLabel="RDO"
      />
    </div>
  );
}
