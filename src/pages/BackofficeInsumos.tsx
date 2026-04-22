import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { supplyService } from "@/features/supplies";
import type { InsumoSaida, InsumoDevolucao } from "@/features/supplies";
import { useErrorHandler } from "@/hooks/useErrorHandler";

export default function BackofficeInsumos() {
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  const [saidas, setSaidas] = useState<InsumoSaida[]>([]);
  const [devolucoes, setDevolucoes] = useState<InsumoDevolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejeitarOpen, setRejeitarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [target, setTarget] = useState<{ id: string; tipo: "saida" | "devolucao" } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        (supabase as any).from("insumo_saidas")
          .select("*, insumo:insumos(nome,unidade), kit:kits(nome), tecnico:tecnicos(id,profile:profiles(nome)), os:ordens_servico(numero_os)")
          .eq("status", "pendente_aprovacao")
          .order("created_at", { ascending: false }),
        (supabase as any).from("insumo_devolucoes")
          .select("*")
          .eq("status", "pendente_aprovacao")
          .order("created_at", { ascending: false }),
      ]);
      setSaidas((s.data as any) || []);
      setDevolucoes((d.data as any) || []);
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao carregar pendências." }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const aprovar = async (id: string, tipo: "saida" | "devolucao") => {
    if (!user?.id) return;
    try {
      if (tipo === "saida") await supplyService.aprovarSaida(id, user.id);
      else await supplyService.aprovarDevolucao(id, user.id);
      toast.success("Aprovado!");
      load();
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao aprovar." }); }
  };

  const confirmarRejeicao = async () => {
    if (!user?.id || !target || !motivo.trim()) { toast.error("Informe o motivo."); return; }
    try {
      if (target.tipo === "saida") await supplyService.rejeitarSaida(target.id, user.id, motivo);
      else await supplyService.rejeitarDevolucao(target.id, user.id, motivo);
      toast.success("Rejeitado.");
      setRejeitarOpen(false); setMotivo(""); setTarget(null);
      load();
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao rejeitar." }); }
  };

  if (loading) return <div className="container mx-auto py-8"><div className="text-center">Carregando...</div></div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Validação de Insumos</h1>

      <Tabs defaultValue="saidas">
        <TabsList>
          <TabsTrigger value="saidas">Saídas pendentes ({saidas.length})</TabsTrigger>
          <TabsTrigger value="devolucoes">Devoluções pendentes ({devolucoes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="saidas" className="space-y-3 mt-4">
          {saidas.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma saída pendente.</p>}
          {saidas.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {s.insumo?.nome || s.kit?.nome || "—"} • {s.quantidade} {s.insumo?.unidade || ""}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      OS {s.os?.numero_os || "—"} • Técnico {s.tecnico?.profile?.nome || "—"}
                    </p>
                  </div>
                  {s.retornavel && <Badge variant="secondary">Retornável</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setTarget({ id: s.id, tipo: "saida" }); setRejeitarOpen(true); }}>Rejeitar</Button>
                <Button size="sm" onClick={() => aprovar(s.id, "saida")}>Aprovar</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="devolucoes" className="space-y-3 mt-4">
          {devolucoes.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma devolução pendente.</p>}
          {devolucoes.map(d => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Devolução • Qtd {d.quantidade}</CardTitle>
                {d.observacoes && <p className="text-sm text-muted-foreground">{d.observacoes}</p>}
              </CardHeader>
              <CardContent className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setTarget({ id: d.id, tipo: "devolucao" }); setRejeitarOpen(true); }}>Rejeitar</Button>
                <Button size="sm" onClick={() => aprovar(d.id, "devolucao")}>Aprovar</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
