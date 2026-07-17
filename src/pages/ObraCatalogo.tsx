import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { BookOpen, Check, ChevronsUpDown, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CatalogoItem {
  id: string;
  item_key: string;
  label: string;
  unidade: string;
  categoria: string;
  tipo: string | null;
  sort_order: number | null;
  ativo: boolean;
  created_at: string;
}

const TIPO_OPTIONS = ['instalacao', 'comissionamento', 'civil', 'eletrica', 'logistica', 'outros'] as const;
const TIPO_LABEL: Record<string, string> = {
  instalacao: 'Instalação',
  comissionamento: 'Comissionamento',
  civil: 'Civil',
  eletrica: 'Elétrica',
  logistica: 'Logística',
  outros: 'Outros',
};

interface FormState {
  id?: string;
  item_key: string;
  label: string;
  unidade: string;
  categoria: string;
  tipo: string | null;
  sort_order: number;
  ativo: boolean;
}

const EMPTY: FormState = { item_key: '', label: '', unidade: 'un', categoria: '', tipo: null, sort_order: 0, ativo: true };

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function modeOf<T extends string | null>(arr: T[]): T | undefined {
  const counts = new Map<string, { v: T; n: number }>();
  for (const v of arr) {
    const k = v == null ? '__null__' : String(v);
    const cur = counts.get(k);
    if (cur) cur.n++;
    else counts.set(k, { v, n: 1 });
  }
  let best: { v: T; n: number } | undefined;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best?.v;
}

export default function ObraCatalogo() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [ativoFilter, setAtivoFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [itemKeyDirty, setItemKeyDirty] = useState(false);
  const [categoriaPopoverOpen, setCategoriaPopoverOpen] = useState(false);
  const [categoriaSearch, setCategoriaSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<CatalogoItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rdo-catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rdo_atividades_catalogo')
        .select('*')
        .order('categoria', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogoItem[];
    },
    staleTime: 5 * 60_000,
  });

  // Categorias existentes (distintas, ordenadas)
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.categoria?.trim()) set.add(i.categoria.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [items]);

  // Defaults por categoria (moda de unidade/tipo, próximo sort_order)
  const defaultsPorCategoria = useMemo(() => {
    const map: Record<string, { unidade: string; tipo: string | null; proximoSortOrder: number }> = {};
    const grouped = new Map<string, CatalogoItem[]>();
    for (const i of items) {
      const k = i.categoria?.trim();
      if (!k) continue;
      const arr = grouped.get(k) ?? [];
      arr.push(i);
      grouped.set(k, arr);
    }
    for (const [cat, arr] of grouped) {
      const unidade = modeOf(arr.map((i) => i.unidade || 'un')) ?? 'un';
      const tipo = modeOf(arr.map((i) => i.tipo ?? null)) ?? null;
      const maxOrder = arr.reduce((m, i) => Math.max(m, i.sort_order ?? 0), 0);
      map[cat] = { unidade, tipo, proximoSortOrder: maxOrder + 1 };
    }
    return map;
  }, [items]);

  const upsertMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const row = {
        item_key: payload.item_key.trim(),
        label: payload.label.trim(),
        unidade: payload.unidade.trim() || 'un',
        categoria: payload.categoria.trim(),
        tipo: payload.tipo,
        sort_order: payload.sort_order ?? 0,
        ativo: payload.ativo,
      };
      if (payload.id) {
        const { error } = await supabase.from('rdo_atividades_catalogo').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rdo_atividades_catalogo').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rdo-catalogo'] });
      setDialogOpen(false);
      setForm(EMPTY);
      toast.success('Atividade salva');
    },
    onError: (e: any) => toast.error(`Falha ao salvar: ${e.message ?? e}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rdo_atividades_catalogo').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rdo-catalogo'] });
      toast.success('Atividade removida');
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(`Falha ao remover: ${e.message ?? e}`),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (tipoFilter !== 'all' && (i.tipo ?? '') !== tipoFilter) return false;
      if (ativoFilter === 'ativos' && !i.ativo) return false;
      if (ativoFilter === 'inativos' && i.ativo) return false;
      if (!q) return true;
      return [i.label, i.item_key, i.categoria, i.unidade].some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [items, search, tipoFilter, ativoFilter]);

  const isCreating = !form.id;

  const openCreate = () => {
    setForm(EMPTY);
    setItemKeyDirty(false);
    setDialogOpen(true);
  };
  const openEdit = (i: CatalogoItem) => {
    setForm({
      id: i.id, item_key: i.item_key, label: i.label, unidade: i.unidade,
      categoria: i.categoria, tipo: i.tipo, sort_order: i.sort_order ?? 0, ativo: i.ativo,
    });
    setItemKeyDirty(true);
    setDialogOpen(true);
  };

  // Label -> item_key auto-slug (apenas na criação, enquanto o usuário não editou a chave manualmente)
  const handleLabelChange = (label: string) => {
    setForm((f) => {
      const next: FormState = { ...f, label };
      if (isCreating && !itemKeyDirty) next.item_key = slugify(label);
      return next;
    });
  };

  const handleItemKeyChange = (v: string) => {
    setItemKeyDirty(true);
    setForm({ ...form, item_key: v });
  };

  // Aplica defaults ao escolher categoria existente (somente na criação, sem sobrescrever escolhas do usuário)
  const applyCategoria = (categoria: string) => {
    setForm((f) => {
      const next: FormState = { ...f, categoria };
      if (isCreating) {
        const d = defaultsPorCategoria[categoria];
        if (d) {
          if (!f.unidade || f.unidade === 'un') next.unidade = d.unidade;
          if (f.tipo == null) next.tipo = d.tipo;
          if (!f.sort_order) next.sort_order = d.proximoSortOrder;
        }
      }
      return next;
    });
    setCategoriaPopoverOpen(false);
    setCategoriaSearch('');
  };

  const handleSubmit = () => {
    if (!form.label.trim() || !form.item_key.trim() || !form.categoria.trim()) {
      toast.error('Preencha label, chave e categoria');
      return;
    }
    upsertMutation.mutate(form);
  };

  const categoriaSearchTrim = categoriaSearch.trim();
  const filteredCategorias = useMemo(() => {
    const q = categoriaSearchTrim.toLowerCase();
    if (!q) return categoriasDisponiveis;
    return categoriasDisponiveis.filter((c) => c.toLowerCase().includes(q));
  }, [categoriasDisponiveis, categoriaSearchTrim]);
  const canCreateNewCategoria =
    categoriaSearchTrim.length > 0 &&
    !categoriasDisponiveis.some((c) => c.toLowerCase() === categoriaSearchTrim.toLowerCase());

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Catálogo de Atividades (RDO)
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 min-h-11" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full sm:w-44 min-h-11"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {TIPO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ativoFilter} onValueChange={setAtivoFilter}>
              <SelectTrigger className="w-full sm:w-36 min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="min-h-11">
              <Plus className="h-4 w-4 mr-2" /> Nova atividade
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Nenhuma atividade encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.label}</TableCell>
                      <TableCell className="font-mono text-xs">{i.item_key}</TableCell>
                      <TableCell>{i.categoria}</TableCell>
                      <TableCell>{i.tipo ? TIPO_LABEL[i.tipo] ?? i.tipo : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{i.unidade}</TableCell>
                      <TableCell>{i.sort_order ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={i.ativo ? 'default' : 'secondary'}>{i.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(i)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(i)} aria-label="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar atividade' : 'Nova atividade'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Label *</Label>
              <Input value={form.label} onChange={(e) => handleLabelChange(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Chave (item_key) *</Label>
              <Input
                value={form.item_key}
                className="font-mono"
                onChange={(e) => handleItemKeyChange(e.target.value)}
                placeholder="ex: instalacao_painel"
              />
              {isCreating && !itemKeyDirty && (
                <p className="text-[11px] text-muted-foreground">Gerada automaticamente a partir do Label. Edite se precisar.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Categoria *</Label>
                <Popover open={categoriaPopoverOpen} onOpenChange={setCategoriaPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoriaPopoverOpen}
                      className={cn('justify-between font-normal', !form.categoria && 'text-muted-foreground')}
                    >
                      {form.categoria || 'Selecione ou digite...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar ou criar categoria..."
                        value={categoriaSearch}
                        onValueChange={setCategoriaSearch}
                      />
                      <CommandList>
                        {filteredCategorias.length === 0 && !canCreateNewCategoria && (
                          <CommandEmpty>Nenhuma categoria.</CommandEmpty>
                        )}
                        {filteredCategorias.length > 0 && (
                          <CommandGroup heading="Existentes">
                            {filteredCategorias.map((c) => (
                              <CommandItem key={c} value={c} onSelect={() => applyCategoria(c)}>
                                <Check className={cn('mr-2 h-4 w-4', form.categoria === c ? 'opacity-100' : 'opacity-0')} />
                                {c}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {canCreateNewCategoria && (
                          <CommandGroup heading="Nova">
                            <CommandItem
                              value={`__new__${categoriaSearchTrim}`}
                              onSelect={() => applyCategoria(categoriaSearchTrim)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Criar "{categoriaSearchTrim}"
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo ?? 'none'} onValueChange={(v) => setForm({ ...form, tipo: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem tipo —</SelectItem>
                    {TIPO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Unidade</Label>
                <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="un, m², kg..." />
              </div>
              <div className="grid gap-1.5">
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} id="ativo" />
              <Label htmlFor="ativo" className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-11">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={upsertMutation.isPending} className="min-h-11">
              {upsertMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.label}" será removida do catálogo. RDOs antigos que a utilizam não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
