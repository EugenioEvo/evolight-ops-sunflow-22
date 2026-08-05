import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Activity, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { useActivitiesQuery, type ActivityRow } from '@/features/activities';

const PAGE_SIZE = 20;

type SortKey = 'data' | 'pessoaNome' | 'tipo' | 'destino' | 'numero' | 'horasMeta' | 'horasReais';

const fmtH = (v: number | null) =>
  v === null || v === undefined ? '—' : `${v.toFixed(2).replace('.', ',')} h`;

const monthKey = (d: string) => (d ? d.slice(0, 7) : '');

export default function Atividades() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useActivitiesQuery();

  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [pessoaFilter, setPessoaFilter] = useState('all');
  const [mesFilter, setMesFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('data');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const pessoaOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.pessoaNome))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const mesOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => monthKey(r.data)).filter(Boolean))).sort().reverse(),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tipoFilter !== 'all' && r.tipo !== tipoFilter) return false;
      if (pessoaFilter !== 'all' && r.pessoaNome !== pessoaFilter) return false;
      if (mesFilter !== 'all' && monthKey(r.data) !== mesFilter) return false;
      if (!term) return true;
      return [r.pessoaNome, r.destino, r.numero, r.tipo].some((v) => v?.toLowerCase().includes(term));
    });
  }, [rows, search, tipoFilter, pessoaFilter, mesFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' || typeof bv === 'number') {
        return ((av as number ?? -1) - (bv as number ?? -1)) * dir;
      }
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totals = useMemo(() => {
    const meta = filtered.reduce((s, r) => s + (r.horasMeta ?? 0), 0);
    const real = filtered.reduce((s, r) => s + (r.horasReais ?? 0), 0);
    return {
      count: filtered.length,
      rme: filtered.filter((r) => r.tipo === 'RME').length,
      rdo: filtered.filter((r) => r.tipo === 'RDO').length,
      os: filtered.filter((r) => r.tipo === 'OS').length,
      meta,
      real,
      aderencia: meta > 0 ? (real / meta) * 100 : null,
    };
  }, [filtered]);


  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'data' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {sortKey === k ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  const exportCsv = () => {
    const header = ['Data', 'Usuário', 'Tipo', 'Obra/Cliente', 'Número', 'Status', 'Carga Meta (h)', 'Carga Real (h)'];
    const lines = sorted.map((r) =>
      [r.data, r.pessoaNome, r.tipo, r.destino, r.numero, r.status ?? '', r.horasMeta ?? '', r.horasReais ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `atividades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fmtData = (d: string) => {
    if (!d) return '—';
    try {
      return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Atividades
          </h1>
          <p className="text-sm text-muted-foreground">
            Serviços executados (RME) e diários de obra (RDO) por usuário e período
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!sorted.length}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.count}</div>
            <p className="text-xs text-muted-foreground">{totals.rme} RME · {totals.rdo} RDO</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Carga Meta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtH(totals.meta)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Carga Real</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtH(totals.real)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Aderência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.aderencia === null ? '—' : `${totals.aderencia.toFixed(0)}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário, obra/cliente, nº..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="RME">RME</SelectItem>
                <SelectItem value="RDO">RDO</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pessoaFilter} onValueChange={(v) => { setPessoaFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {pessoaOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mesFilter} onValueChange={(v) => { setMesFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                {mesOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {format(parseISO(`${m}-01`), "MMMM 'de' yyyy", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={7} rows={8} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead k="data" label="Data" />
                      <SortHead k="pessoaNome" label="Usuário" />
                      <SortHead k="tipo" label="Tipo" />
                      <SortHead k="destino" label="Obra / Cliente" />
                      <SortHead k="numero" label="Nº" />
                      <SortHead k="horasMeta" label="Carga Meta" className="text-right" />
                      <SortHead k="horasReais" label="Carga Real" className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma atividade encontrada para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((r: ActivityRow) => (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer"
                          onClick={() => navigate(r.link)}
                        >
                          <TableCell className="whitespace-nowrap">{fmtData(r.data)}</TableCell>
                          <TableCell className="font-medium">{r.pessoaNome}</TableCell>
                          <TableCell>
                            <Badge variant={r.tipo === 'RME' ? 'default' : 'secondary'}>{r.tipo}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">{r.destino}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{r.numero}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{fmtH(r.horasMeta)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium">{fmtH(r.horasReais)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={sorted.length}
                  itemsPerPage={PAGE_SIZE}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
