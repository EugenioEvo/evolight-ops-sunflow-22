import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, THeader, TableRow } from '@/components/ui/table' as any;
import { Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

type PessoaTipo = 'profile' | 'prestador' | 'custom';
type Vinculo = 'contratado' | 'subcontratado';

interface Afastamento {
  id: string;
  profile_id: string | null;
  prestador_id: string | null;
  nome_customizado: string | null;
  vinculo: Vinculo;
  obra_id: string | null;
  local_customizado: string | null;
  data_acidente: string;
  descricao: string;
  data_afastamento: string;
  dias_afastado: number;
  data_retorno: string;
  observacoes: string | null;
  created_at: string;
  profiles?: { nome: string } | null;
  prestadores?: { nome: string } | null;
  obras?: { nome: string } | null;
}

export default function HseAfastamentos() {
  const { profile } = useAuth();
  const isAllowed = (profile?.roles || []).some((r: string) => ['admin', 'engenharia'].includes(r));

  const [items, setItems] = useState<Afastamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Afastamento | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; nome: string }[]>([]);
  const [prestadores, setPrestadores] = useState<{ id: string; nome: string }[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterObra, setFilterObra] = useState<string>('all');
  const [filterVinculo, setFilterVinculo] = useState<string>('all');

  // form
  const [pessoaTipo, setPessoaTipo] = useState<PessoaTipo>('profile');
  const [profileId, setProfileId] = useState<string>('');
  const [prestadorId, setPrestadorId] = useState<string>('');
  const [nomeCustom, setNomeCustom] = useState('');
  const [vinculo, setVinculo] = useState<Vinculo>('contratado');
  const [obraId, setObraId] = useState<string>('');
  const [localCustom, setLocalCustom] = useState('');
  const [dataAcidente, setDataAcidente] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataAfastamento, setDataAfastamento] = useState('');
  const [diasAfastado, setDiasAfastado] = useState<number>(1);
  const [dataRetorno, setDataRetorno] = useState('');
  const [dataRetornoEdited, setDataRetornoEdited] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (isAllowed) {
      loadAll();
    } else {
      setLoading(false);
    }
  }, [isAllowed]);

  // auto data_retorno = afastamento + dias
  useEffect(() => {
    if (dataRetornoEdited) return;
    if (!dataAfastamento || !diasAfastado) return;
    const d = new Date(dataAfastamento + 'T00:00:00');
    d.setDate(d.getDate() + Number(diasAfastado));
    setDataRetorno(d.toISOString().split('T')[0]);
  }, [dataAfastamento, diasAfastado, dataRetornoEdited]);

  const loadAll = async () => {
    setLoading(true);
    const [afRes, prRes, presRes, obrasRes] = await Promise.all([
      supabase
        .from('hse_afastamentos')
        .select('*, profiles(nome), prestadores(nome), obras(nome)')
        .order('data_afastamento', { ascending: false }),
      supabase.from('profiles').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('prestadores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('obras').select('id, nome').order('nome'),
    ]);
    if (afRes.error) toast.error(afRes.error.message);
    setItems((afRes.data as any) || []);
    setProfiles(prRes.data || []);
    setPrestadores(presRes.data || []);
    setObras(obrasRes.data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setPessoaTipo('profile');
    setProfileId('');
    setPrestadorId('');
    setNomeCustom('');
    setVinculo('contratado');
    setObraId('');
    setLocalCustom('');
    setDataAcidente('');
    setDescricao('');
    setDataAfastamento('');
    setDiasAfastado(1);
    setDataRetorno('');
    setDataRetornoEdited(false);
    setObservacoes('');
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setDlgOpen(true);
  };

  const openEdit = (a: Afastamento) => {
    setEditing(a);
    setPessoaTipo(a.profile_id ? 'profile' : a.prestador_id ? 'prestador' : 'custom');
    setProfileId(a.profile_id || '');
    setPrestadorId(a.prestador_id || '');
    setNomeCustom(a.nome_customizado || '');
    setVinculo(a.vinculo);
    setObraId(a.obra_id || '');
    setLocalCustom(a.local_customizado || '');
    setDataAcidente(a.data_acidente);
    setDescricao(a.descricao);
    setDataAfastamento(a.data_afastamento);
    setDiasAfastado(a.dias_afastado);
    setDataRetorno(a.data_retorno);
    setDataRetornoEdited(true);
    setObservacoes(a.observacoes || '');
    setDlgOpen(true);
  };

  const submit = async () => {
    if (pessoaTipo === 'profile' && !profileId) return toast.error('Selecione a pessoa');
    if (pessoaTipo === 'prestador' && !prestadorId) return toast.error('Selecione o prestador');
    if (pessoaTipo === 'custom' && !nomeCustom.trim()) return toast.error('Informe o nome');
    if (!dataAcidente || !descricao.trim() || !dataAfastamento || !dataRetorno)
      return toast.error('Preencha os campos obrigatórios');

    const payload = {
      profile_id: pessoaTipo === 'profile' ? profileId : null,
      prestador_id: pessoaTipo === 'prestador' ? prestadorId : null,
      nome_customizado: pessoaTipo === 'custom' ? nomeCustom.trim() : null,
      vinculo,
      obra_id: obraId || null,
      local_customizado: !obraId && localCustom.trim() ? localCustom.trim() : null,
      data_acidente: dataAcidente,
      descricao: descricao.trim(),
      data_afastamento: dataAfastamento,
      dias_afastado: Number(diasAfastado),
      data_retorno: dataRetorno,
      observacoes: observacoes.trim() || null,
    };

    const { error } = editing
      ? await supabase.from('hse_afastamentos').update(payload).eq('id', editing.id)
      : await supabase.from('hse_afastamentos').insert({ ...payload, created_by: profile?.user_id });

    if (error) return toast.error(error.message);
    toast.success(editing ? 'Afastamento atualizado' : 'Afastamento registrado');
    setDlgOpen(false);
    resetForm();
    loadAll();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este afastamento?')) return;
    const { error } = await supabase.from('hse_afastamentos').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Excluído');
    loadAll();
  };

  const filtered = useMemo(() => {
    return items.filter((a) => {
      const d = new Date(a.data_afastamento + 'T00:00:00');
      if (filterYear !== 'all' && String(d.getFullYear()) !== filterYear) return false;
      if (filterMonth !== 'all' && String(d.getMonth() + 1) !== filterMonth) return false;
      if (filterObra !== 'all' && a.obra_id !== filterObra) return false;
      if (filterVinculo !== 'all' && a.vinculo !== filterVinculo) return false;
      return true;
    });
  }, [items, filterYear, filterMonth, filterObra, filterVinculo]);

  const stats = useMemo(() => {
    const totalAcidentes = filtered.length;
    const diasPerdidos = filtered.reduce((s, a) => s + (a.dias_afastado || 0), 0);
    const porObra = new Map<string, number>();
    for (const a of filtered) {
      const nome = a.obras?.nome || a.local_customizado || '—';
      porObra.set(nome, (porObra.get(nome) || 0) + 1);
    }
    const topObras = Array.from(porObra.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return { totalAcidentes, diasPerdidos, topObras };
  }, [filtered]);

  if (!isAllowed) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            Acesso restrito a Admin e Engenharia.
          </CardContent>
        </Card>
      </div>
    );
  }

  const years = Array.from(
    new Set(items.map((a) => new Date(a.data_afastamento + 'T00:00:00').getFullYear())),
  ).sort((a, b) => b - a);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">HSE — Afastamentos</h1>
          <p className="text-sm text-muted-foreground">Registro de acidentes e afastamentos.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo afastamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Acidentes no período</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats.totalAcidentes}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Dias perdidos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stats.diasPerdidos}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Top obras / locais</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {stats.topObras.length === 0 && <span className="text-muted-foreground">—</span>}
            {stats.topObras.map(([n, c]) => (
              <div key={n} className="flex justify-between">
                <span className="truncate mr-2">{n}</span>
                <span className="font-semibold">{c}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Ano</Label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>{String(m).padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Obra</Label>
            <Select value={filterObra} onValueChange={setFilterObra}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vínculo</Label>
            <Select value={filterVinculo} onValueChange={setFilterVinculo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="contratado">Contratado</SelectItem>
                <SelectItem value="subcontratado">Subcontratado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-3">Pessoa</th>
                <th className="text-left p-3">Vínculo</th>
                <th className="text-left p-3">Local</th>
                <th className="text-left p-3">Acidente</th>
                <th className="text-left p-3">Afastamento</th>
                <th className="text-left p-3">Dias</th>
                <th className="text-left p-3">Retorno</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum afastamento no filtro.</td></tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="border-t hover:bg-muted/20">
                  <td className="p-3">
                    {a.profiles?.nome || a.prestadores?.nome || a.nome_customizado}
                  </td>
                  <td className="p-3 capitalize">{a.vinculo}</td>
                  <td className="p-3">{a.obras?.nome || a.local_customizado || '—'}</td>
                  <td className="p-3">{format(new Date(a.data_acidente + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                  <td className="p-3">{format(new Date(a.data_afastamento + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                  <td className="p-3">{a.dias_afastado}</td>
                  <td className="p-3">{format(new Date(a.data_retorno + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dlgOpen} onOpenChange={(o) => { setDlgOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar afastamento' : 'Novo afastamento'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tipo de pessoa</Label>
              <Select value={pessoaTipo} onValueChange={(v) => setPessoaTipo(v as PessoaTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profile">Usuário do sistema</SelectItem>
                  <SelectItem value="prestador">Prestador</SelectItem>
                  <SelectItem value="custom">Nome customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pessoaTipo === 'profile' && (
              <div>
                <Label>Usuário *</Label>
                <Select value={profileId} onValueChange={setProfileId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {pessoaTipo === 'prestador' && (
              <div>
                <Label>Prestador *</Label>
                <Select value={prestadorId} onValueChange={setPrestadorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {prestadores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {pessoaTipo === 'custom' && (
              <div>
                <Label>Nome *</Label>
                <Input value={nomeCustom} onChange={(e) => setNomeCustom(e.target.value)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vínculo *</Label>
                <Select value={vinculo} onValueChange={(v) => setVinculo(v as Vinculo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contratado">Contratado</SelectItem>
                    <SelectItem value="subcontratado">Subcontratado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Obra</Label>
                <Select value={obraId || 'none'} onValueChange={(v) => setObraId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— (usar texto livre)</SelectItem>
                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!obraId && (
              <div>
                <Label>Local (texto livre)</Label>
                <Input value={localCustom} onChange={(e) => setLocalCustom(e.target.value)} placeholder="Ex.: Escritório central" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do acidente *</Label>
                <Input type="date" value={dataAcidente} onChange={(e) => setDataAcidente(e.target.value)} />
              </div>
              <div>
                <Label>Data do afastamento *</Label>
                <Input type="date" value={dataAfastamento} onChange={(e) => setDataAfastamento(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dias afastado *</Label>
                <Input
                  type="number"
                  min={0}
                  value={diasAfastado}
                  onChange={(e) => {
                    setDataRetornoEdited(false);
                    setDiasAfastado(Number(e.target.value));
                  }}
                />
              </div>
              <div>
                <Label>Data de retorno *</Label>
                <Input
                  type="date"
                  value={dataRetorno}
                  onChange={(e) => {
                    setDataRetornoEdited(true);
                    setDataRetorno(e.target.value);
                  }}
                />
              </div>
            </div>

            <div>
              <Label>Descrição *</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>{editing ? 'Salvar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
