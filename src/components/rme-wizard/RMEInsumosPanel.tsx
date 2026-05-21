import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, RotateCcw, AlertCircle, Camera, ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { supplyService } from "@/features/supplies";
import type { InsumoDevolucao, DevolucaoEvidencia } from "@/features/supplies";
import { useErrorHandler } from "@/hooks/useErrorHandler";

interface Pendencia {
  saida_id: string;
  ordem_servico_id: string;
  numero_os: string;
  insumo_nome: string | null;
  kit_nome: string | null;
  quantidade: number;
  quantidade_devolvida: number;
  retornavel: boolean;
  status: string;
  tecnico_nome: string;
}

interface Props {
  rmeId?: string;
  rmeStatus: string;
}

export const RMEInsumosPanel = ({ rmeId, rmeStatus }: Props) => {
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  const [items, setItems] = useState<Pendencia[]>([]);
  const [devolucoesPorSaida, setDevolucoesPorSaida] = useState<Record<string, InsumoDevolucao[]>>({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Pendencia | null>(null);
  const [qtd, setQtd] = useState<number>(0);
  const [obs, setObs] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const podeDevolver = rmeStatus === "rascunho" || rmeStatus === "rejeitado";

  const load = async () => {
    if (!rmeId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_rme_pendencias_insumos", { p_rme_id: rmeId });
      if (error) throw error;
      const pendencias = (data as Pendencia[]) || [];
      setItems(pendencias);

      const saidaIds = pendencias.map(p => p.saida_id);
      if (saidaIds.length) {
        const { data: devs } = await (supabase as any)
          .from("insumo_devolucoes")
          .select("*")
          .in("saida_id", saidaIds)
          .order("created_at", { ascending: false });
        const map: Record<string, InsumoDevolucao[]> = {};
        (devs || []).forEach((d: InsumoDevolucao) => {
          (map[d.saida_id] = map[d.saida_id] || []).push(d);
        });
        setDevolucoesPorSaida(map);
      } else {
        setDevolucoesPorSaida({});
      }
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao carregar insumos." }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [rmeId]);

  const abrirDevolucao = (it: Pendencia) => {
    setTarget(it);
    setQtd(Math.max(it.quantidade - it.quantidade_devolvida, 0));
    setObs("");
    setFiles([]);
    setOpen(true);
  };

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const MAX_IMG = 5 * 1024 * 1024, MAX_VID = 50 * 1024 * 1024;
    const valid: File[] = [];
    for (const f of Array.from(newFiles)) {
      const isVid = f.type.startsWith("video/");
      const isImg = f.type.startsWith("image/");
      if (!isVid && !isImg) { toast.error(`${f.name}: tipo inválido`); continue; }
      if (isImg && f.size > MAX_IMG) { toast.error(`${f.name}: imagem >5MB`); continue; }
      if (isVid && f.size > MAX_VID) { toast.error(`${f.name}: vídeo >50MB`); continue; }
      valid.push(f);
    }
    setFiles(prev => [...prev, ...valid].slice(0, 10));
  };

  const confirmar = async () => {
    if (!user?.id || !target) return;
    if (qtd <= 0) { toast.error("Quantidade inválida."); return; }
    if (qtd > target.quantidade - target.quantidade_devolvida) {
      toast.error("Quantidade maior que o saldo."); return;
    }
    setSubmitting(true);
    try {
      let evidencias: DevolucaoEvidencia[] = [];
      if (files.length > 0) {
        evidencias = await supplyService.uploadDevolucaoEvidencias(target.saida_id, files);
      }
      await supplyService.createDevolucao({
        saida_id: target.saida_id, quantidade: qtd, registrada_por: user.id, observacoes: obs, evidencias,
      });
      toast.success("Devolução registrada — aguardando validação do BackOffice.");
      setOpen(false); setTarget(null); setFiles([]); load();
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao registrar devolução." }); }
    finally { setSubmitting(false); }
  };

  if (!rmeId) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />Insumos vinculados às OS deste ticket
          </CardTitle>
          {!podeDevolver && (
            <Badge variant="secondary" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />Devoluções bloqueadas (RME {rmeStatus})
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma saída de insumo registrada para as OS deste ticket.</p>
        )}
        {!loading && items.length > 0 && (
          <div className="space-y-2">
            {items.map(it => {
              const devs = devolucoesPorSaida[it.saida_id] || [];
              const devPendentes = devs.filter(d => d.status === 'pendente_aprovacao');
              const devAprovadas = devs.filter(d => d.status === 'aprovada');
              const totalPendente = devPendentes.reduce((s, d) => s + d.quantidade, 0);
              const saldoFisico = it.quantidade - it.quantidade_devolvida - totalPendente;
              return (
                <div key={it.saida_id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{it.insumo_nome || it.kit_nome || "—"}</span>
                      {it.retornavel
                        ? <Badge variant="secondary" className="text-xs"><RotateCcw className="h-3 w-3 mr-1" />Retornável</Badge>
                        : <Badge variant="outline" className="text-xs">Consumível</Badge>}
                      <Badge variant="outline" className="text-xs">{it.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      OS {it.numero_os} • Téc. {it.tecnico_nome} • Saída {it.quantidade}
                      {devAprovadas.length > 0 && ` • Devolvido ${it.quantidade_devolvida}`}
                      {totalPendente > 0 && ` • Em análise ${totalPendente}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled={!podeDevolver || saldoFisico <= 0} onClick={() => abrirDevolucao(it)}>
                    Devolver
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar devolução</DialogTitle></DialogHeader>
          {target && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {target.insumo_nome || target.kit_nome} • OS {target.numero_os}
              </p>
              <div>
                <Label>Quantidade a devolver</Label>
                <Input type="number" min={1} max={target.quantidade - target.quantidade_devolvida}
                  value={qtd} onChange={(e) => setQtd(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo disponível: {target.quantidade - target.quantidade_devolvida}
                </p>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label>Fotos / vídeos do item devolvido</Label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-1" />Câmera
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-1" />Galeria
                  </Button>
                  <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" multiple hidden
                    onChange={(e) => addFiles(e.target.files)} />
                  <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden
                    onChange={(e) => addFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative border rounded p-2 text-xs">
                        <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                        <p className="truncate">{f.name}</p>
                        <p className="text-muted-foreground">{f.type.startsWith('video/') ? '🎥 vídeo' : '🖼️ imagem'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={confirmar} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
