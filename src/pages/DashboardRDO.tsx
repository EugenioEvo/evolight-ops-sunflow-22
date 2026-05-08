import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, CheckCircle2, Clock, FileSpreadsheet, XCircle } from 'lucide-react';
import { useRDOMetrics, type RDOPeriod } from '@/features/rdo/hooks/useRDOMetrics';

const PERIOD_LABEL: Record<RDOPeriod, string> = { mes: 'Mês corrente', '30d': 'Últimos 30 dias', '90d': 'Últimos 90 dias' };

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardRDO() {
  const [period, setPeriod] = useState<RDOPeriod>('mes');
  const { data, isLoading } = useRDOMetrics(period);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> Dashboard RDO
          </h1>
          <p className="text-sm text-muted-foreground">Indicadores dos relatórios diários de obra.</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as RDOPeriod)}>
          <SelectTrigger className="w-full md:w-56 min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABEL) as RDOPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="RDOs no período" value={data.totalPeriodo} icon={Activity} tone="bg-primary/10 text-primary" />
            <StatCard label="Pendentes" value={data.pendentes} icon={Clock} tone="bg-amber-500/10 text-amber-500" />
            <StatCard label="Aprovados" value={data.aprovados} icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-500" />
            <StatCard label="Rejeitados" value={data.rejeitados} icon={XCircle} tone="bg-destructive/10 text-destructive" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Horas por Obra (top 10)</CardTitle></CardHeader>
              <CardContent>
                {data.horasPorObra.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem horas registradas no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.horasPorObra} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="obra" stroke="hsl(var(--muted-foreground))" fontSize={12} width={140} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                      <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Horas por Prestador (top 10)</CardTitle></CardHeader>
              <CardContent>
                {data.horasPorPrestador.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem horas registradas no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.horasPorPrestador} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="prestador" stroke="hsl(var(--muted-foreground))" fontSize={12} width={140} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                      <Bar dataKey="horas" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
