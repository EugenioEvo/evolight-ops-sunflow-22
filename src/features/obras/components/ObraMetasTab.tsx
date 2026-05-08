import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { obraMetasService, type ObraMeta } from '../services/obraMetasService';

interface CatalogoItem {
  id: string;
  label: string;
  categoria: string;
  unidade: string;
  sort_order: number | null;
}

interface Props {
  obraId: string | null;
  /** Coletor externo: pai chama getDirty() ao salvar a obra */
  registerSaveHandler?: (handler: (obraId: string) => Promise<void>) => void;
}

export function ObraMetasTab({ obraId, registerSaveHandler }: Props) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [obs, setObs] = useState<Record<string, string>>({});

  const catalogoQ = useQuery<CatalogoItem[]>({
    queryKey: ['rdo-catalogo-metas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rdo_atividades_catalogo')
        .select('id, label, categoria, unidade, sort_order')
        .eq('ativo', true)
        .order('categoria')
        .order('sort_order')
        .order('label');
      if (error) throw error;
      return (data || []) as CatalogoItem[];
    },
    staleTime: 5 * 60_000,
  });

  const metasQ = useQuery({
    queryKey: ['obra-metas', obraId],
    enabled: !!obraId,
    queryFn: () => obraMetasService.listByObra(obraId!),
  });

  useEffect(() => {
    if (!metasQ.data) return;
    const v: Record<string, string> = {};
    const o: Record<string, string> = {};
    for (const m of metasQ.data as ObraMeta[]) {
      v[m.catalogo_id] = m.quantidade_meta != null ? String(m.quantidade_meta) : '';
      o[m.catalogo_id] = m.observacoes ?? '';
    }
    setValores(v);
    setObs(o);
  }, [metasQ.data]);

  // Registra handler de save para o pai chamar após criar/atualizar a obra
  useEffect(() => {
    if (!registerSaveHandler) return;
    registerSaveHandler(async (savedObraId: string) => {
      const items = (catalogoQ.data ?? []).map((c) => ({
        catalogo_id: c.id,
        quantidade_meta: valores[c.id] ? Number(valores[c.id]) : 0,
        unidade: c.unidade,
        observacoes: obs[c.id] || null,
      })).filter((it) => it.quantidade_meta > 0 || obs[it.catalogo_id]);
      if (items.length > 0) {
        await obraMetasService.upsertMany(savedObraId, items);
      }
    });
  }, [registerSaveHandler, catalogoQ.data, valores, obs]);

  const grupos = useMemo(() => {
    const map = new Map<string, CatalogoItem[]>();
    for (const c of catalogoQ.data ?? []) {
      const arr = map.get(c.categoria) ?? [];
      arr.push(c);
      map.set(c.categoria, arr);
    }
    return Array.from(map.entries());
  }, [catalogoQ.data]);

  if (catalogoQ.isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Defina a meta total prevista para cada item do catálogo. O sistema cruzará automaticamente com o que for executado nos RDOs aprovados para mostrar o avanço por etapa na página da obra.
      </p>
      {grupos.map(([categoria, items]) => (
        <div key={categoria} className="border rounded-md">
          <div className="px-3 py-2 bg-muted/50 font-medium text-sm capitalize">{categoria}</div>
          <div className="divide-y">
            {items.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 p-3 items-end">
                <div className="col-span-12 md:col-span-5">
                  <Label className="text-xs">{c.label}</Label>
                  <p className="text-[11px] text-muted-foreground">Unidade: {c.unidade}</p>
                </div>
                <div className="col-span-5 md:col-span-3">
                  <Label className="text-xs">Meta total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder={`0 ${c.unidade}`}
                    value={valores[c.id] ?? ''}
                    onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })}
                  />
                </div>
                <div className="col-span-7 md:col-span-4">
                  <Label className="text-xs">Observações</Label>
                  <Input
                    placeholder="Ex.: incluso 5% de reserva"
                    value={obs[c.id] ?? ''}
                    onChange={(e) => setObs({ ...obs, [c.id]: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!obraId && (
        <p className="text-xs text-muted-foreground italic">
          As metas serão salvas automaticamente após criar a obra.
        </p>
      )}
    </div>
  );
}
