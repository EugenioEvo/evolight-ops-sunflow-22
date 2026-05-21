import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, ImageIcon, X, Loader2, RotateCcw, PackagePlus, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { supplyService } from "@/features/supplies";
import type { InsumoSaida, DevolucaoEvidencia } from "@/features/supplies";
import { useErrorHandler } from "@/hooks/useErrorHandler";

interface DevolucaoRow {
  saida_id: string;
  lote_id: string;
  ordem_servico_id: string;
  numero_os: string;
  insumo_nome: string | null;
  kit_nome: string | null;
  quantidade: number;
  quantidade_devolvida: number;
  retornavel: boolean;
  saida_status: string;
  tecnico_nome: string;
  saida_created_at: string;
  devolucoes: Array<{
    id: string; quantidade: number; status: string; observacoes: string | null;
    rejeitado_motivo: string | null; evidencias?: DevolucaoEvidencia[]; created_at: string;
  }>;
}

interface EntradaRow {
  id: string;
  saida_id: string;
  ordem_servico_id: string;
  numero_os: string;
  insumo_nome: string | null;
  kit_nome: string | null;
  quantidade: number;
  status: string;
  observacoes: string | null;
  evidencias?: DevolucaoEvidencia[];
  rejeitado_motivo: string | null;
  tecnico_nome: string;
  created_at: string;
}

export default function BackofficeInsumos() {
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  const [saidas, setSaidas] = useState<InsumoSaida[]>([]);
  const [devolucoes, setDevolucoes] = useState<DevolucaoRow[]>([]);
  const [entradas, setEntradas] = useState<EntradaRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Rejeição (saídas / devoluções / entradas)
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [target, setTarget] = useState<{ id: string; tipo: "saida" | "devolucao" | "entrada" } | null>(null);

  // Registrar devolução manualmente (em nome do técnico)
  const [regOpen, setRegOpen] = useState(false);
  const [regTarget, setRegTarget] = useState<DevolucaoRow | null>(null);
  const [qtd, setQtd] = useState(0);
  const [obs, setObs] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, d, e] = await Promise.all([
        (supabase as any).from("insumo_saidas")
          .select("*, insumo:insumos(nome,unidade), kit:kits(nome), tecnico:tecnicos(id,profile:profiles(nome)), os:ordens_servico(numero_os)")
          .eq("status", "pendente_aprovacao")
          .order("created_at", { ascending: false }),
        supplyService.getBackofficeDevolucoes(),
        supplyService.getBackofficeEntradasPendentes(),
      ]);
      setSaidas((s.data as any) || []);
      setDevolucoes(d as DevolucaoRow[]);
      setEntradas(e as EntradaRow[]);
    } catch (err) { handleError(err, { fallbackMessage: "Erro ao carregar pendências." }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const aprovar = async (id: string, tipo: "saida" | "devolucao" | "entrada") => {
    if (!user?.id) return;
    try {
      if (tipo === "saida") await supplyService.aprovarSaida(id, user.id);
      else if (tipo === "devolucao") await supplyService.aprovarDevolucao(id, user.id);
      else await supplyService.aprovarEntradaPendente(id, user.id);
      toast.success("Aprovado!");
      load();
    } catch (err) { handleError(err, { fallbackMessage: "Erro ao aprovar." }); }
  };

  const confirmarRejeicao = async () => {
    if (!user?.id || !target || !motivo.trim()) { toast.error("Informe o motivo."); return; }
    try {
      if (target.tipo === "saida") await supplyService.rejeitarSaida(target.id, user.id, motivo);
      else if (target.tipo === "devolucao") await supplyService.rejeitarDevolucao(target.id, user.id, motivo);
      else await supplyService.rejeitarEntradaPendente(target.id, user.id, motivo);
      toast.success("Rejeitado.");
      setRejeitarOpen(false); setMotivo(""); setTarget(null);
      load();
    } catch (err) { handleError(err, { fallbackMessage: "Erro ao rejeitar." }); }
  };

  // Saldo disponível para devolução manual em uma saída-irmã do lote (calculado pelo backend, mas estimativa local)
  const saldoSaida = (row: DevolucaoRow) => {
    const pend = row.devolucoes.filter(d => d.status === 'pendente_aprovacao').reduce((s, d) => s + d.quantidade, 0);
    return row.quantidade - row.quantidade_devolvida - pend;
  };

  const abrirRegistroManual = (row: DevolucaoRow) => {
    setRegTarget(row);
    setQtd(saldoSaida(row));
    setObs("");
    setFiles([]);
    setRegOpen(true);
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

  const confirmarRegistro = async () => {
    if (!user?.id || !regTarget || qtd <= 0) { toast.error("Quantidade inválida."); return; }
    setSubmitting(true);
    try {
      let evidencias: DevolucaoEvidencia[] = [];
      if (files.length > 0) evidencias = await supplyService.uploadDevolucaoEvidencias(regTarget.saida_id, files);
      await supplyService.createDevolucao({
        saida_id: regTarget.saida_id, quantidade: qtd, registrada_por: user.id,
        observacoes: obs || "Registrada manualmente pelo BackOffice", evidencias,
      });
      toast.success("Devolução registrada — propagada ao lote.");
      setRegOpen(false); setRegTarget(null); setFiles([]);
      load();
    } catch (err) { handleError(err, { fallbackMessage: "Erro ao registrar devolução." }); }
    finally { setSubmitting(false); }
  };

  // Agrupar devoluções por lote para exibição compacta
  const devGrouped = (() => {
    const byLote: Record<string, DevolucaoRow[]> = {};
    devolucoes.forEach(r => { (byLote[r.lote_id] = byLote[r.lote_id] || []).push(r); });
    return Object.values(byLote).map(rows => {
      const rep = [...rows].sort((a, b) => a.saida_created_at.localeCompare(b.saida_created_at))[0];
      return { rep, rows, osList: rows.map(r => r.numero_os) };
    });
  })();

  const devPendentes = devGrouped.filter(g => saldoSaida(g.rep) > 0 || g.rep.devolucoes.some(d => d.status === 'pendente_aprovacao'));
  const devFeitas = devGrouped.filter(g => g.rep.devolucoes.length > 0);

  if (loading) return <div className="container mx-auto py-8"><div className="text-center">Carregando...</div></div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Validação de Insumos</h1>

      <Tabs defaultValue="saidas">
        <TabsList>
          <TabsTrigger value="saidas">Saídas pendentes ({saidas.length})</TabsTrigger>
          <TabsTrigger value="devolucoes">Devoluções ({devolucoes.length})</TabsTrigger>
          <TabsTrigger value="entradas">Entradas pendentes ({entradas.length})</TabsTrigger>
        </TabsList>

        {/* SAÍDAS PENDENTES */}
        <TabsContent value="saidas" className="space-y-3 mt-4">
          {saidas.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma saída pendente.</p>}
          {saidas.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base">
                      {s.insumo?.nome || s.kit?.nome || "—"} • {s.quantidade} {s.insumo?.unidade || ""}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      OS {s.os?.numero_os || "—"} • Técnico {s.tecnico?.profile?.nome || "—"}
                    </p>
                  </div>
                  {s.retornavel && <Badge variant="secondary"><RotateCcw className="h-3 w-3 mr-1" />Retornável</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setTarget({ id: s.id, tipo: "saida" }); setRejeitarOpen(true); }}>Rejeitar</Button>
                <Button size="sm" onClick={() => aprovar(s.id, "saida")}>Aprovar</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* DEVOLUÇÕES (todas as saídas retornáveis em aberto) */}
        <TabsContent value="devolucoes" className="space-y-4 mt-4">
          <Tabs defaultValue="pendentes">
            <TabsList>
              <TabsTrigger value="pendentes">Faltando devolver / em análise ({devPendentes.length})</TabsTrigger>
              <TabsTrigger value="historico">Já registradas ({devFeitas.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pendentes" className="space-y-3 mt-4">
              {devPendentes.length === 0 && <p className="text-muted-foreground text-center py-8">Sem pendências.</p>}
              {devPendentes.map(({ rep, osList, rows }) => {
                const saldo = saldoSaida(rep);
                const pendList = rep.devolucoes.filter(d => d.status === 'pendente_aprovacao');
                return (
                  <Card key={rep.lote_id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <CardTitle className="text-base">{rep.insumo_nome || rep.kit_nome} • Qtd {rep.quantidade}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Téc. {rep.tecnico_nome} • OSs: {osList.join(", ")}
                            {osList.length > 1 && " (mesmo lote)"}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {saldo > 0 && <Badge>Saldo {saldo}</Badge>}
                          {pendList.length > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Em análise</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {pendList.map(d => (
                        <div key={d.id} className="flex items-center justify-between gap-2 border rounded p-2 text-sm">
                          <div>
                            <span>Devolução qtd {d.quantidade}</span>
                            {d.observacoes && <p className="text-xs text-muted-foreground">{d.observacoes}</p>}
                            {d.evidencias && d.evidencias.length > 0 && <p className="text-xs text-muted-foreground">📎 {d.evidencias.length} anexo(s)</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setTarget({ id: d.id, tipo: "devolucao" }); setRejeitarOpen(true); }}>Rejeitar</Button>
                            <Button size="sm" onClick={() => aprovar(d.id, "devolucao")}>Aprovar</Button>
                          </div>
                        </div>
                      ))}
                      {saldo > 0 && (
                        <Button size="sm" variant="secondary" className="w-full" onClick={() => abrirRegistroManual(rep)}>
                          <RotateCcw className="h-4 w-4 mr-1" />Registrar devolução manualmente (propaga ao lote)
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="historico" className="space-y-3 mt-4">
              {devFeitas.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma devolução registrada.</p>}
              {devFeitas.map(({ rep, osList }) => (
                <Card key={rep.lote_id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{rep.insumo_nome || rep.kit_nome} • Téc. {rep.tecnico_nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">OSs: {osList.join(", ")}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-xs">
                      {rep.devolucoes.map(d => (
                        <div key={d.id} className="flex items-center gap-2 flex-wrap">
                          {d.status === 'aprovada' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                          {d.status === 'rejeitada' && <AlertCircle className="h-3 w-3 text-destructive" />}
                          {d.status === 'pendente_aprovacao' && <Loader2 className="h-3 w-3 text-amber-600" />}
                          <span>Qtd {d.quantidade}</span>
                          <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                          {d.rejeitado_motivo && <span className="text-destructive">— {d.rejeitado_motivo}</span>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ENTRADAS PENDENTES */}
        <TabsContent value="entradas" className="space-y-3 mt-4">
          {entradas.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma entrada pendente.</p>}
          {entradas.map(e => (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PackagePlus className="h-4 w-4" />
                      {e.insumo_nome || e.kit_nome} • Qtd {e.quantidade}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      OS {e.numero_os} • Téc. {e.tecnico_nome}
                    </p>
                    {e.observacoes && <p className="text-xs mt-1">{e.observacoes}</p>}
                    {e.evidencias && e.evidencias.length > 0 && <p className="text-xs text-muted-foreground">📎 {e.evidencias.length} anexo(s)</p>}
                  </div>
                  <Badge variant="outline">{e.status}</Badge>
                </div>
              </CardHeader>
              {e.status === 'pendente_aprovacao' && (
                <CardContent className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setTarget({ id: e.id, tipo: "entrada" }); setRejeitarOpen(true); }}>Rejeitar</Button>
                  <Button size="sm" onClick={() => aprovar(e.id, "entrada")}>Aprovar e dar entrada</Button>
                </CardContent>
              )}
              {e.rejeitado_motivo && (
                <CardContent><p className="text-xs text-destructive">Rejeitada: {e.rejeitado_motivo}</p></CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Modal de rejeição (genérico) */}
      <Dialog open={rejeitarOpen} onOpenChange={setRejeitarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo da rejeição</DialogTitle></DialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitarOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarRejeicao}>Confirmar Rejeição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de registro manual de devolução (em nome do técnico) */}
      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar devolução manualmente</DialogTitle></DialogHeader>
          {regTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {regTarget.insumo_nome || regTarget.kit_nome} • Téc. {regTarget.tecnico_nome}
              </p>
              <p className="text-xs bg-muted p-2 rounded">
                Será propagada automaticamente a todas as OSs do mesmo lote.
              </p>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} max={saldoSaida(regTarget)} value={qtd}
                  onChange={(e) => setQtd(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">Saldo: {saldoSaida(regTarget)}</p>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={confirmarRegistro} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Registrar (propaga ao lote)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
