import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Building2, Calendar, FileSpreadsheet, MapPin, Users, Image as ImageIcon, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { OBRA_STATUS_LABEL, ObraProgressoEtapas } from '@/features/obras';
import { RDO_STATUS_LABEL, RDO_STATUS_VARIANT, type RDOStatus } from '@/features/rdo/types';

interface Props { mode?: 'staff' | 'cliente' }

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planejada: 'secondary',
  em_execucao: 'default',
  pausada: 'outline',
  concluida: 'default',
  cancelada: 'destructive',
};

async function signObjectUrl(path: string): Promise<string | null> {
  // Evidence/photos may use a few buckets; try common ones.
  const buckets = ['rdo-evidences', 'ordens-servico', 'rme-evidences'];
  for (const b of buckets) {
    const { data } = await supabase.storage.from(b).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}

function formatDateOnlyBR(value?: string | null): string {
  if (!value) return '—';
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function ObraDetail({ mode = 'staff' }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // photoUrls é derivado da query abaixo (não usa useState para evitar
  // perder as fotos quando o React Query devolve cache sem re-executar o queryFn).

  const { data: obra, isLoading: loadingObra } = useQuery({
    queryKey: ['obra', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('obras').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [{ data: cli }, { data: prest }] = await Promise.all([
        data.cliente_id ? supabase.from('clientes').select('id, empresa, endereco, cidade, estado').eq('id', data.cliente_id).maybeSingle() : Promise.resolve({ data: null } as any),
        data.responsavel_obra_id ? supabase.from('prestadores').select('id, nome').eq('id', data.responsavel_obra_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      return { ...data, cliente: cli ?? null, responsavel: prest ?? null };
    },
    staleTime: 5 * 60_000,
  });

  const { data: rdos = [], isLoading: loadingRdos } = useQuery({
    queryKey: ['obra-rdos', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rdo_relatorios')
        .select(`
          id, numero_rdo, data_rdo, status, fotos_geral,
          equipe:rdo_equipe(prestador_id, horas_trabalhadas, horas_extras),
          atividades:rdo_atividades(catalogo_id, quantidade, percentual_avanco),
          evidencias:rdo_evidencias(storage_path, descricao)
        `)
        .eq('obra_id', id!)
        .order('data_rdo', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 5 * 60_000,
  });

  const aprovados = useMemo(() => rdos.filter((r) => r.status === 'aprovado'), [rdos]);

  const { data: metas = {} } = useQuery({
    queryKey: ['obra-metas-map', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('obra_metas_catalogo').select('catalogo_id, quantidade_meta').eq('obra_id', id!);
      const map: Record<string, number> = {};
      (data ?? []).forEach((m: any) => { if (m.catalogo_id) map[m.catalogo_id] = Number(m.quantidade_meta ?? 0); });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const avancoSerie = useMemo(() => {
    // Para cada RDO aprovado: média do % de avanço das atividades daquele dia
    // (fallback: quantidade / meta * 100 quando percentual_avanco vier nulo).
    // A série acumula somando as médias diárias dos RDOs aprovados (cap em 100%).
    const sorted = [...aprovados].sort((a, b) => a.data_rdo.localeCompare(b.data_rdo));
    let acc = 0;
    return sorted.map((r) => {
      const vals = (r.atividades ?? []).map((a: any) => {
        if (a.percentual_avanco != null) return Number(a.percentual_avanco);
        const meta = a.catalogo_id ? metas[a.catalogo_id] : 0;
        return meta > 0 ? (Number(a.quantidade ?? 0) / meta) * 100 : 0;
      });
      const avgDia = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      acc = Math.min(100, acc + avgDia);
      return { data: r.data_rdo, avanco: Math.round(acc * 100) / 100 };
    });
  }, [aprovados, metas]);

  const equipe = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of aprovados) {
      for (const e of r.equipe ?? []) {
        const h = Number(e.horas_trabalhadas ?? 0) + Number(e.horas_extras ?? 0);
        map.set(e.prestador_id, (map.get(e.prestador_id) ?? 0) + h);
      }
    }
    return map;
  }, [aprovados]);

  const { data: equipeNomes = {} } = useQuery({
    queryKey: ['obra-equipe-nomes', id, Array.from(equipe.keys()).sort().join(',')],
    enabled: equipe.size > 0,
    queryFn: async () => {
      const ids = Array.from(equipe.keys());
      const { data } = await supabase.from('prestadores').select('id, nome').in('id', ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.nome; });
      return map;
    },
    staleTime: 10 * 60_000,
  });

  // Resolve photo signed URLs (lazy, single effect via query)
  useQuery({
    queryKey: ['obra-photos', id, rdos.length],
    enabled: rdos.length > 0,
    queryFn: async () => {
      const items: { path: string; descricao?: string | null; data?: string }[] = [];
      for (const r of rdos) {
        for (const e of r.evidencias ?? []) {
          if (e.storage_path) items.push({ path: e.storage_path, descricao: e.descricao, data: r.data_rdo });
        }
        for (const f of r.fotos_geral ?? []) {
          if (typeof f === 'string') items.push({ path: f, data: r.data_rdo });
        }
      }
      const resolved = await Promise.all(items.map(async (i) => {
        const url = await signObjectUrl(i.path);
        return url ? { url, descricao: i.descricao, data: i.data } : null;
      }));
      const ok = resolved.filter(Boolean) as { url: string; descricao?: string | null; data?: string }[];
      setPhotoUrls(ok);
      return ok;
    },
    staleTime: 10 * 60_000,
  });

  if (loadingObra) {
    return <div className="container mx-auto p-6 space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }
  if (!obra) {
    return <div className="container mx-auto p-6"><p className="text-muted-foreground">Obra não encontrada.</p></div>;
  }

  const enderecoCompleto = [obra.endereco, obra.cidade, obra.estado, obra.cep].filter(Boolean).join(', ');
  const isStaff = mode === 'staff';

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="min-h-11">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" /> {obra.nome}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {obra.cliente?.empresa ?? <span className="italic">Sem cliente vinculado</span>}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[obra.status] ?? 'secondary'} className="self-start">
              {OBRA_STATUS_LABEL[obra.status as keyof typeof OBRA_STATUS_LABEL] ?? obra.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {enderecoCompleto && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><p className="text-xs text-muted-foreground">Endereço</p><p>{enderecoCompleto}</p></div>
            </div>
          )}
          {obra.potencia_kwp != null && (
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><p className="text-xs text-muted-foreground">Potência</p><p>{obra.potencia_kwp} kWp</p></div>
            </div>
          )}
          {obra.data_inicio_prevista && (
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Início previsto</p>
                <p>{new Date(obra.data_inicio_prevista).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          )}
          {obra.data_fim_prevista && (
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Fim previsto</p>
                <p>{new Date(obra.data_fim_prevista).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          )}
          {isStaff && obra.responsavel?.nome && (
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><p className="text-xs text-muted-foreground">Responsável</p><p>{obra.responsavel.nome}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <ObraProgressoEtapas obraId={obra.id} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Avanço acumulado (RDOs aprovados)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {avancoSerie.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de avanço.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={avancoSerie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                  <Line type="monotone" dataKey="avanco" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {isStaff && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Equipe alocada</CardTitle></CardHeader>
            <CardContent>
              {equipe.size === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem equipe registrada nos RDOs.</p>
              ) : (
                <ul className="divide-y">
                  {Array.from(equipe.entries()).sort((a, b) => b[1] - a[1]).map(([pid, h]) => (
                    <li key={pid} className="py-2 flex items-center justify-between text-sm">
                      <span>{equipeNomes[pid] ?? '—'}</span>
                      <span className="text-muted-foreground">{Math.round(h * 10) / 10} h</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Timeline de RDOs</CardTitle></CardHeader>
        <CardContent>
          {loadingRdos ? (
            <Skeleton className="h-40" />
          ) : rdos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum RDO emitido ainda.</p>
          ) : (
            <ol className="relative border-l ml-3 space-y-4">
              {rdos.map((r) => (
                <li key={r.id} className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary" />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                    <div>
                      <p className="font-medium">RDO {r.numero_rdo} — {formatDateOnlyBR(r.data_rdo)}</p>
                      <p className="text-xs text-muted-foreground">{(r.atividades ?? []).length} atividade(s) · {(r.equipe ?? []).length} pessoa(s)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={RDO_STATUS_VARIANT[r.status as RDOStatus]}>{RDO_STATUS_LABEL[r.status as RDOStatus]}</Badge>
                      {isStaff && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/rdo/${r.id}`)}>Abrir</Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Galeria consolidada</CardTitle></CardHeader>
        <CardContent>
          {photoUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem fotos registradas.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photoUrls.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="group block">
                  <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                    <img src={p.url} loading="lazy" alt={p.descricao ?? 'Foto da obra'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  {(p.descricao || p.data) && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{p.descricao ?? formatDateOnlyBR(p.data)}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
