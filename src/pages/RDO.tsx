import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Trash2, FileSpreadsheet, Loader2, Pencil, Undo2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';
import { useAuth } from '@/hooks/useAuth';
import { useRDOQuery, useRDOMutations, RDO_STATUS_LABEL, RDO_STATUS_VARIANT, type RDOStatus } from '@/features/rdo';

const STAFF_ROLES = ['admin', 'engenharia', 'supervisao', 'lider'] as const;
const ADM_ENG_ROLES = ['admin', 'engenharia'] as const;
const PAGE_SIZE = 20;

type SortKey = 'numero_rdo' | 'data_rdo' | 'obra' | 'responsavel' | 'status';

export default function RDO() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: rdos = [], isLoading } = useRDOQuery();
  const { remove, reopen } = useRDOMutations();
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [toReopen, setToReopen] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('data_rdo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [obraFilter, setObraFilter] = useState('all');
  const [respFilter, setRespFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const isStaff = profile?.roles?.some((r) => (STAFF_ROLES as readonly string[]).includes(r)) ?? false;
  const isAdmEng = profile?.roles?.some((r) => (ADM_ENG_ROLES as readonly string[]).includes(r)) ?? false;
  const canCreate = isStaff || profile?.roles?.some((r) => r === 'sup_eletromecanico' || r === 'lider_eletromecanico');

  const obraOptions = useMemo(
    () => Array.from(new Set(rdos.map((r) => r.obra?.nome).filter(Boolean) as string[])).sort(),
    [rdos],
  );
  const respOptions = useMemo(
    () => Array.from(new Set(rdos.map((r) => r.responsavel?.nome).filter(Boolean) as string[])).sort(),
    [rdos],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(rdos.map((r) => r.status).filter(Boolean) as string[])),
    [rdos],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" />
      : sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rdos.filter((r) => {
      if (obraFilter !== 'all' && r.obra?.nome !== obraFilter) return false;
      if (respFilter !== 'all' && r.responsavel?.nome !== respFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.numero_rdo, r.obra?.nome, r.responsavel?.nome, r.obra?.cidade, (r as any).observacoes_gerais]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

    const val = (r: typeof rdos[number]) => {
      switch (sortKey) {
        case 'numero_rdo': return r.numero_rdo ?? '';
        case 'obra': return r.obra?.nome ?? '';
        case 'responsavel': return r.responsavel?.nome ?? '';
        case 'status': return r.status ?? '';
        default: return r.data_rdo ?? '';
      }
    };
    list = [...list].sort((a, b) => {
      const cmp = String(val(a)).localeCompare(String(val(b)), 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rdos, search, obraFilter, respFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => { setPage(1); }, [search, obraFilter, respFilter, statusFilter, sortKey, sortDir]);
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);


  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" /> RDO — Relatório Diário de Obra
          </h1>
          <p className="text-sm text-muted-foreground">
            {isStaff ? 'Todos os RDOs.' : 'Seus RDOs e os das obras em que você atua.'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/rdo/novo')} className="min-h-11">
            <Plus className="h-4 w-4 mr-2" /> Novo RDO
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lista</CardTitle>
          <div className="relative pt-2">
            <Search className="absolute left-3 top-5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, obra, cidade ou responsável…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum RDO encontrado.
            </div>
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
                    <TableHead className="w-32" />

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/rdo/${r.id}`)}
                    >
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {isAdmEng && r.status === 'aprovado' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/rdo/${r.id}?edit=1`)}
                                aria-label="Editar RDO aprovado"
                                title="Editar (Adm/Engenharia)"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setToReopen(r.id)}
                                aria-label="Retornar RDO para rascunho"
                                title="Retornar para rascunho"
                              >
                                <Undo2 className="h-4 w-4 text-amber-500" />
                              </Button>
                            </>
                          )}
                          {isStaff && r.status === 'rascunho' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setToDelete(r.id)}
                              aria-label="Remover RDO"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover RDO?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e remove o relatório e todos os seus itens vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) remove.mutate(toDelete);
                setToDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toReopen} onOpenChange={(open) => !open && setToReopen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retornar RDO para rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              O RDO voltará ao status <strong>rascunho</strong>, permitindo que o responsável edite e
              reenvie para aprovação. A aprovação atual (aprovador, data e observações) será descartada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toReopen) reopen.mutate(toReopen);
                setToReopen(null);
              }}
            >
              Retornar para rascunho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
