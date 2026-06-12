import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, Trash2, FileSpreadsheet, Loader2, Pencil, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useRDOQuery, useRDOMutations, RDO_STATUS_LABEL, RDO_STATUS_VARIANT, type RDOStatus } from '@/features/rdo';

const STAFF_ROLES = ['admin', 'engenharia', 'supervisao', 'lider'] as const;
const ADM_ENG_ROLES = ['admin', 'engenharia'] as const;

export default function RDO() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: rdos = [], isLoading } = useRDOQuery();
  const { remove, reopen } = useRDOMutations();
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [toReopen, setToReopen] = useState<string | null>(null);

  const isStaff = profile?.roles?.some((r) => (STAFF_ROLES as readonly string[]).includes(r)) ?? false;
  const isAdmEng = profile?.roles?.some((r) => (ADM_ENG_ROLES as readonly string[]).includes(r)) ?? false;
  const canCreate = isStaff || profile?.roles?.some((r) => r === 'sup_eletromecanico' || r === 'lider_eletromecanico');


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rdos;
    return rdos.filter((r) =>
      [r.numero_rdo, r.obra?.nome, r.responsavel?.nome, r.obra?.cidade]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rdos, search]);

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
