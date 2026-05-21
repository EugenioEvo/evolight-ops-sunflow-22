import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, RotateCcw, Camera, ImageIcon, X, Loader2, AlertCircle, CheckCircle2, PackagePlus, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supplyService } from "@/features/supplies";
import type { MinhaDevolucao, DevolucaoEvidencia } from "@/features/supplies";
import { useErrorHandler } from "@/hooks/useErrorHandler";

type Mode = "devolucao" | "entrada";

export default function MinhasDevolucoes() {
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  const [items, setItems] = useState<MinhaDevolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pendentes" | "historico">("pendentes");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("devolucao");
  const [target, setTarget] = useState<MinhaDevolucao | null>(null);
  const [qtd, setQtd] = useState(0);
  const [obs, setObs] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await supplyService.getMinhasDevolucoes();
      setItems(data);
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao carregar devoluções." }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // saldoRetornavel: o que ainda pode ser devolvido em items RETORNÁVEIS
  const saldoRetornavel = (it: MinhaDevolucao) => {
    const pend = it.devolucoes.filter(d => d.status === 'pendente_aprovacao').reduce((s, d) => s + d.quantidade, 0);
    return it.quantidade - it.quantidade_devolvida - pend;
  };
  // saldoEntrada: o que ainda pode virar "sobra" em items NÃO-RETORNÁVEIS
  const saldoEntrada = (it: MinhaDevolucao) => {
    const ja = (it.entradas || []).filter(e => e.status !== 'rejeitada').reduce((s, e) => s + e.quantidade, 0);
    return it.quantidade - ja;
  };
  const saldo = (it: MinhaDevolucao) => it.retornavel ? saldoRetornavel(it) : saldoEntrada(it);

  // Agrupar saídas-irmãs por lote_id (devolução cascata, mostra só um card representante)
  const grouped = (() => {
    const byLote: Record<string, MinhaDevolucao[]> = {};
    items.forEach(it => {
      (byLote[it.lote_id] = byLote[it.lote_id] || []).push(it);
    });
    return Object.values(byLote).map(group => {
      // Representante = o mais antigo (primeiro inserido)
      const rep = [...group].sort((a, b) => a.saida_created_at.localeCompare(b.saida_created_at))[0];
      const osList = group.map(g => g.numero_os);
      return { rep, group, osList };
    });
  })();

  const comSaldo = grouped.filter(g => saldo(g.rep) > 0);
  const historico = grouped.filter(g =>
    g.rep.devolucoes.length > 0 || (g.rep.entradas || []).length > 0
  );

  const abrir = (it: MinhaDevolucao, m: Mode) => {
    setMode(m);
    setTarget(it);
    setQtd(m === "devolucao" ? saldoRetornavel(it) : saldoEntrada(it));
    setObs("");
    setFiles([]);
    setOpen(true);
  };

  const addFiles = (nf: FileList | null) => {
    if (!nf) return;
    const MAX_IMG = 5 * 1024 * 1024, MAX_VID = 50 * 1024 * 1024;
    const valid: File[] = [];
    for (const f of Array.from(nf)) {
      const isVid = f.type.startsWith("video/"), isImg = f.type.startsWith("image/");
      if (!isVid && !isImg) { toast.error(`${f.name}: tipo inválido`); continue; }
      if (isImg && f.size > MAX_IMG) { toast.error(`${f.name}: imagem >5MB`); continue; }
      if (isVid && f.size > MAX_VID) { toast.error(`${f.name}: vídeo >50MB`); continue; }
      valid.push(f);
    }
    setFiles(prev => [...prev, ...valid].slice(0, 10));
  };

  const confirmar = async () => {
    if (!user?.id || !target) return;
    const lim = mode === "devolucao" ? saldoRetornavel(target) : saldoEntrada(target);
    if (qtd <= 0) { toast.error("Quantidade inválida."); return; }
    if (qtd > lim) { toast.error("Maior que o saldo."); return; }
    setSubmitting(true);
    try {
      let evidencias: DevolucaoEvidencia[] = [];
      if (files.length > 0) evidencias = await supplyService.uploadDevolucaoEvidencias(target.saida_id, files);
      if (mode === "devolucao") {
        await supplyService.createDevolucao({
          saida_id: target.saida_id, quantidade: qtd, registrada_por: user.id, observacoes: obs, evidencias,
        });
        toast.success("Devolução registrada — propagada às OSs do mesmo lote, aguardando validação.");
      } else {
        await supplyService.createEntradaPendente({
          saida_id: target.saida_id, quantidade: qtd, registrada_por: user.id, observacoes: obs, evidencias,
        });
        toast.success("Sobra registrada — aguardando validação do BackOffice.");
      }
      setOpen(false); setTarget(null); setFiles([]); load();
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao registrar." }); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="container mx-auto py-8 text-center">Carregando...</div>;

  const renderCard = (g: { rep: MinhaDevolucao; group: MinhaDevolucao[]; osList: string[] }, mostrarBotao: boolean) => {
    const { rep, osList } = g;
    const s = saldo(rep);
    const devs = rep.devolucoes || [];
    const entradas = rep.entradas || [];
    const emAnalise = devs.filter(d => d.status === 'pendente_aprovacao').reduce((sum, d) => sum + d.quantidade, 0)
      + entradas.filter(e => e.status === 'pendente_aprovacao').reduce((sum, e) => sum + e.quantidade, 0);
    return (
      <Card key={rep.lote_id}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                {rep.insumo_nome || rep.kit_nome || "—"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                {osList.length > 1 && <LinkIcon className="h-3 w-3" />}
                OS {osList.join(", ")} • Saída de {rep.quantidade} • Devolvido {rep.quantidade_devolvida}
              </p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {rep.retornavel
                ? <Badge variant="secondary"><RotateCcw className="h-3 w-3 mr-1" />Retornável</Badge>
                : <Badge variant="outline">Consumível</Badge>}
              {osList.length > 1 && <Badge variant="outline" className="text-[10px]">{osList.length} OSs</Badge>}
              {emAnalise > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Em análise {emAnalise}</Badge>}
              {s > 0 && <Badge variant="default">Saldo {s}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(devs.length > 0 || entradas.length > 0) && (
            <div className="text-xs space-y-1 border-l-2 pl-2">
              {devs.map(d => (
                <div key={d.id} className="flex items-center gap-2 flex-wrap">
                  {d.status === 'aprovada' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  {d.status === 'rejeitada' && <AlertCircle className="h-3 w-3 text-destructive" />}
                  {d.status === 'pendente_aprovacao' && <Loader2 className="h-3 w-3 text-amber-600" />}
                  <span>Devolução qtd {d.quantidade}</span>
                  <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                  {d.evidencias && d.evidencias.length > 0 && <span className="text-muted-foreground">📎 {d.evidencias.length}</span>}
                  {d.rejeitado_motivo && <span className="text-destructive">— {d.rejeitado_motivo}</span>}
                </div>
              ))}
              {entradas.map(e => (
                <div key={e.id} className="flex items-center gap-2 flex-wrap">
                  {e.status === 'aprovada' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  {e.status === 'rejeitada' && <AlertCircle className="h-3 w-3 text-destructive" />}
                  {e.status === 'pendente_aprovacao' && <Loader2 className="h-3 w-3 text-amber-600" />}
                  <span>Sobra qtd {e.quantidade}</span>
                  <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                  {e.evidencias && e.evidencias.length > 0 && <span className="text-muted-foreground">📎 {e.evidencias.length}</span>}
                  {e.rejeitado_motivo && <span className="text-destructive">— {e.rejeitado_motivo}</span>}
                </div>
              ))}
            </div>
          )}
          {mostrarBotao && s > 0 && (
            rep.retornavel
              ? <Button size="sm" className="w-full" onClick={() => abrir(rep, "devolucao")}>
                  <RotateCcw className="h-4 w-4 mr-1" />Devolver agora
                </Button>
              : <Button size="sm" variant="secondary" className="w-full" onClick={() => abrir(rep, "entrada")}>
                  <PackagePlus className="h-4 w-4 mr-1" />Registrar sobra (não retornável)
                </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-3xl font-bold">Minhas Devoluções</h1>
      <p className="text-sm text-muted-foreground">
        Itens retornáveis viram devolução; itens consumíveis com sobra viram entrada pendente para o BackOffice validar.
        Saídas vinculadas a múltiplas OSs são tratadas em conjunto.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pendentes">Com saldo ({comSaldo.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="space-y-2 mt-4">
          {comSaldo.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum item com saldo.</p>}
          {comSaldo.map(g => renderCard(g, true))}
        </TabsContent>
        <TabsContent value="historico" className="space-y-2 mt-4">
          {historico.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum registro.</p>}
          {historico.map(g => renderCard(g, false))}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "devolucao" ? "Registrar devolução" : "Registrar sobra (entrada)"}</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {target.insumo_nome || target.kit_nome} • OS {target.numero_os}
              </p>
              {mode === "devolucao" && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Esta devolução será replicada em todas as OSs do mesmo lote automaticamente.
                </p>
              )}
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} max={mode === "devolucao" ? saldoRetornavel(target) : saldoEntrada(target)} value={qtd} onChange={(e) => setQtd(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">Saldo: {mode === "devolucao" ? saldoRetornavel(target) : saldoEntrada(target)}</p>
              </div>
              <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></div>
              <div>
                <Label>Fotos / vídeos</Label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-1" />Câmera
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-1" />Galeria
                  </Button>
                  <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                  <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
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
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
