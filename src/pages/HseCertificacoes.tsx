import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Search, Paperclip, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInCalendarDays, format } from 'date-fns';
import { useDebounce } from '@/hooks/useDebounce';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { Pagination } from '@/components/Pagination';

const BUCKET = 'hse-certificacoes';

interface Anexo { id: string; storage_path: string; nome_original: string | null; }

interface Row {
  id: string;
  pessoa: string;
  vinculo: string;
  tipoNome: string;
  obrigatoria: boolean;
  observacoes: string | null;
  data_vencimento: string | null;
  dias: number | null;
  anexos: Anexo[];
}

type Situacao = 'todas' | 'vencidas' | 'vencendo' | 'validas' | 'sem_validade';

const parseDate = (d: string) => new Date(`${d}T00:00:00`);

export default function HseCertificacoes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('todas');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hse_certificacoes')
      .select(`
        id, observacoes, data_vencimento,
        hse_certificacao_tipos!inner(nome, obrigatoria),
        profiles(nome),
        prestadores(nome),
        hse_certificacao_anexos(id, storage_path, nome_original)
      `);

    if (error) {
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: Row[] = (data || []).map((r: any) => {
      const dias = r.data_vencimento
        ? differenceInCalendarDays(parseDate(r.data_vencimento), new Date())
        : null;
      return {
        id: r.id,
        pessoa: r.profiles?.nome || r.prestadores?.nome || '—',
        vinculo: r.profiles?.nome ? 'Usuário' : r.prestadores?.nome ? 'Prestador' : '—',
        tipoNome: r.hse_certificacao_tipos?.nome ?? '—',
        obrigatoria: !!r.hse_certificacao_tipos?.obrigatoria,
        observacoes: r.observacoes,
        data_vencimento: r.data_vencimento,
        dias,
        anexos: r.hse_certificacao_anexos || [],
      };
    });

    mapped.sort((a, b) => {
      if (a.dias === null && b.dias === null) return a.pessoa.localeCompare(b.pessoa);
      if (a.dias === null) return 1;
      if (b.dias === null) return -1;
      return a.dias - b.dias;
    });

    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAnexo = async (a: Anexo) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error('Erro ao gerar link do anexo'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const stats = useMemo(() => ({
    vencidas: rows.filter(r => r.dias !== null && r.dias < 0).length,
    vencendo: rows.filter(r => r.dias !== null && r.dias >= 0 && r.dias <= 30).length,
    validas: rows.filter(r => r.dias !== null && r.dias > 30).length,
  }), [rows]);

  const buscaDebounced = useDebounce(busca, 500);
  const filtered = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.pessoa.toLowerCase().includes(q) && !r.tipoNome.toLowerCase().includes(q)) return false;
      if (situacao === 'vencidas') return r.dias !== null && r.dias < 0;
      if (situacao === 'vencendo') return r.dias !== null && r.dias >= 0 && r.dias <= 30;
      if (situacao === 'validas') return r.dias !== null && r.dias > 30;
      if (situacao === 'sem_validade') return r.dias === null;
      return true;
    });
  }, [rows, buscaDebounced, situacao]);
  const pager = usePaginatedList(filtered, 20, `${buscaDebounced}|${situacao}`);

  const diasBadge = (r: Row) => {
    if (r.dias === null) return <Badge variant="secondary">Sem validade</Badge>;
    if (r.dias < 0) return <Badge variant="destructive">Vencida há {Math.abs(r.dias)}d</Badge>;
    if (r.dias <= 30) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-100">{r.dias}d</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-100">{r.dias}d</Badge>;
  };

  const anexosCell = (r: Row) =>
    r.anexos.length === 0 ? (
      <span className="text-muted-foreground text-sm">—</span>
    ) : (
      <div className="flex flex-col gap-1 items-start">
        {r.anexos.map(a => (
          <Button key={a.id} variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => openAnexo(a)}>
            <Paperclip className="h-3 w-3 mr-1" />
            {a.nome_original || a.storage_path.split('/').pop()}
          </Button>
        ))}
      </div>
    );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Certificações Cadastradas</h1>
          <p className="text-sm text-muted-foreground">Todas as certificações HSE de usuários e prestadores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Vencidas</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">{stats.vencidas}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" />Vencendo em 30 dias</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">{stats.vencendo}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Válidas</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">{stats.validas}</span></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por pessoa ou certificação..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="vencidas">Vencidas</SelectItem>
                <SelectItem value="vencendo">Vencendo em 30 dias</SelectItem>
                <SelectItem value="validas">Válidas</SelectItem>
                <SelectItem value="sem_validade">Sem validade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Nenhuma certificação encontrada.</p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Certificação</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead>Anexo</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Dias até expirar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pager.pageItems.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.pessoa}</div>
                          <div className="text-xs text-muted-foreground">{r.vinculo}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{r.tipoNome}</span>
                            {r.obrigatoria && <Badge variant="outline" className="text-xs">Obrigatória</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground line-clamp-2">{r.observacoes || '—'}</span>
                        </TableCell>
                        <TableCell>{anexosCell(r)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.data_vencimento ? format(parseDate(r.data_vencimento), 'dd/MM/yyyy') : 'Sem validade'}
                        </TableCell>
                        <TableCell>{diasBadge(r)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {pager.pageItems.map(r => (
                  <Card key={r.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{r.pessoa}</div>
                          <div className="text-xs text-muted-foreground">{r.vinculo}</div>
                        </div>
                        {diasBadge(r)}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span>{r.tipoNome}</span>
                        {r.obrigatoria && <Badge variant="outline" className="text-xs">Obrigatória</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Validade: {r.data_vencimento ? format(parseDate(r.data_vencimento), 'dd/MM/yyyy') : 'Sem validade'}
                      </div>
                      {r.observacoes && <p className="text-sm text-muted-foreground">{r.observacoes}</p>}
                      {anexosCell(r)}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {pager.totalPages > 1 && (
                <Pagination currentPage={pager.page} totalPages={pager.totalPages} onPageChange={pager.setPage}
                  totalItems={pager.totalItems} itemsPerPage={pager.pageSize} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
