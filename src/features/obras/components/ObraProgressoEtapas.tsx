import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Loader2 } from 'lucide-react';
import { useObraProgressoQuery } from '../hooks/useObraMetas';

interface Props { obraId: string }

export function ObraProgressoEtapas({ obraId }: Props) {
  const { data = [], isLoading } = useObraProgressoQuery(obraId);

  const grupos = useMemo(() => {
    const map = new Map<string, typeof data>();
    for (const item of data) {
      const arr = map.get(item.categoria) ?? [];
      arr.push(item);
      map.set(item.categoria, arr);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Avanço por etapa (meta vs realizado)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma meta cadastrada. Edite a obra e preencha a aba "Metas do catálogo".
          </p>
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
  );
}
