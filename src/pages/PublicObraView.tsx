import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Building2, Calendar, MapPin, TrendingUp, ListChecks, Image as ImageIcon, FileSpreadsheet, Sun, ShieldOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { OBRA_STATUS_LABEL } from '@/features/obras';

interface Payload {
  obra: {
    id: string; nome: string; status: string;
    endereco: string | null; cidade: string | null; estado: string | null; cep: string | null;
    potencia_kwp: number | null;
    data_inicio_prevista: string | null; data_fim_prevista: string | null;
    cliente_empresa: string | null;
  };
  progresso: Array<{ catalogo_id: string; label: string; categoria: string; unidade: string; meta: number; realizado: number; pct: number; }>;
  avanco_serie: Array<{ data: string; avanco: number }>;
  rdos: Array<{ id: string; numero_rdo: string; data_rdo: string; status: string; atividades_count: number }>;
  fotos: Array<{ url: string; descricao: string | null; data: string | null }>;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planejada: 'secondary', em_execucao: 'default', pausada: 'outline', concluida: 'default', cancelada: 'destructive',
};

function formatDateOnlyBR(value?: string | null): string {
  if (!value) return '—';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function PublicObraView() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<{ loading: boolean; data: Payload | null; error: string | null }>({
    loading: true, data: null, error: null,
  });

  useEffect(() => {
    if (!token) { setState({ loading: false, data: null, error: 'missing_token' }); return; }
    const run = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/obra-public-view?token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        const body = await res.json();
        if (!res.ok) {
          setState({ loading: false, data: null, error: body?.error ?? 'erro' });
          return;
        }
        setState({ loading: false, data: body as Payload, error: null });
      } catch (e: any) {
        setState({ loading: false, data: null, error: e?.message ?? 'erro' });
      }
    };
    run();
  }, [token]);

  if (state.loading) {
    return <div className="min-h-screen bg-muted/30 p-6"><div className="container mx-auto space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div></div>;
  }

  if (state.error || !state.data) {
    const isRevoked = state.error === 'revoked_token';
    const isInvalid = state.error === 'invalid_token' || state.error === 'missing_token';
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <ShieldOff className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">
              {isRevoked ? 'Link revogado' : isInvalid ? 'Link inválido' : 'Não foi possível carregar'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRevoked
                ? 'Este link de compartilhamento foi revogado pelo responsável da obra. Solicite um novo link.'
                : isInvalid
                  ? 'O link informado não é válido. Verifique o endereço ou peça um novo link ao responsável.'
                  : 'Tente novamente em alguns instantes.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { obra, progresso, avanco_serie, rdos, fotos } = state.data;
  const enderecoCompleto = [obra.endereco, obra.cidade, obra.estado, obra.cep].filter(Boolean).join(', ');

  const grupos = (() => {
    const map = new Map<string, typeof progresso>();
    for (const item of progresso) {
      const arr = map.get(item.categoria) ?? [];
      arr.push(item);
      map.set(item.categoria, arr);
    }
    return Array.from(map.entries());
  })();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10"><Sun className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-sm font-semibold leading-tight">SunFlow</p>
            <p className="text-xs text-muted-foreground leading-tight">Visualização pública</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="h-5 w-5 text-primary" /> {obra.nome}
                </CardTitle>
                {obra.cliente_empresa && <p className="text-sm text-muted-foreground mt-1">{obra.cliente_empresa}</p>}
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
                <div><p className="text-xs text-muted-foreground">Início previsto</p><p>{formatDateOnlyBR(obra.data_inicio_prevista)}</p></div>
              </div>
            )}
            {obra.data_fim_prevista && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Fim previsto</p><p>{formatDateOnlyBR(obra.data_fim_prevista)}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Avanço por etapa (meta vs realizado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {progresso.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma meta cadastrada.</p>
            ) : (
              <div className="space-y-5">
                {grupos.map(([categoria, items]) => (
                  <div key={categoria} className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{categoria}</p>
                    {items.map((it) => (
                      <div key={it.catalogo_id} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{it.label}</span>
                          <Badge variant="outline" className="font-mono">
                            {it.realizado.toLocaleString('pt-BR')} / {it.meta.toLocaleString('pt-BR')} {it.unidade}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={it.pct} className="flex-1" />
                          <span className="text-xs text-muted-foreground w-12 text-right">{it.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Avanço acumulado (RDOs aprovados)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {avanco_serie.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de avanço.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={avanco_serie}>
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

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Timeline de RDOs</CardTitle></CardHeader>
          <CardContent>
            {rdos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum RDO emitido ainda.</p>
            ) : (
              <ol className="relative border-l ml-3 space-y-4">
                {rdos.map((r) => (
                  <li key={r.id} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                      <div>
                        <p className="font-medium">RDO {r.numero_rdo} — {formatDateOnlyBR(r.data_rdo)}</p>
                        <p className="text-xs text-muted-foreground">{r.atividades_count} atividade(s)</p>
                      </div>
                      <Badge variant={r.status === 'aprovado' ? 'default' : 'secondary'}>{r.status}</Badge>
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
            {fotos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem fotos registradas.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {fotos.map((p, i) => {
                  const isVideo = /\.(mp4|webm|mov|m4v|avi|mkv|3gp|quicktime)(\?|$)/i.test(p.url);
                  return (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="group block">
                      <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                        {isVideo ? (
                          <video src={p.url} className="w-full h-full object-cover bg-black" muted playsInline preload="metadata" />
                        ) : (
                          <img src={p.url} loading="lazy" alt={p.descricao ?? 'Foto da obra'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        )}
                      </div>
                      {(p.descricao || p.data) && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{p.descricao ?? formatDateOnlyBR(p.data)}</p>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground py-4">
          Esta página é somente leitura. O acesso pode ser revogado a qualquer momento pelo responsável da obra.
        </p>
      </main>
    </div>
  );
}
