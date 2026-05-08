import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useObrasQuery, useObraMutations, ObraFormDialog, OBRA_STATUS_LABEL, type Obra } from '@/features/obras';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planejada: 'secondary',
  em_execucao: 'default',
  pausada: 'outline',
  concluida: 'default',
  cancelada: 'destructive',
};

export default function Obras() {
  const navigate = useNavigate();
  const { data: obras = [], isLoading } = useObrasQuery();
  const { remove } = useObraMutations();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Obra | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Obra | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return obras;
    return obras.filter((o) =>
      [o.nome, o.cidade, o.estado, o.cliente?.empresa, o.responsavel?.nome]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [obras, search]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Obras
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="min-h-11">
              <Plus className="h-4 w-4 mr-2" /> Nova obra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Nenhuma obra cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>kWp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.nome}</TableCell>
                      <TableCell>{o.cliente?.empresa ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{o.responsavel?.nome ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{[o.cidade, o.estado].filter(Boolean).join('/') || '—'}</TableCell>
                      <TableCell>{o.potencia_kwp ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>
                          {OBRA_STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(o); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(o)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ObraFormDialog open={open} onOpenChange={setOpen} obra={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover obra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. RDOs vinculados ficarão órfãos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (confirmDelete) { await remove.mutateAsync(confirmDelete.id); setConfirmDelete(null); } }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
