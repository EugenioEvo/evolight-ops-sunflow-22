import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { supplyService } from "@/features/supplies";
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
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Pendencia | null>(null);
  const [qtd, setQtd] = useState<number>(0);
  const [obs, setObs] = useState("");

  const podeDevolver = rmeStatus === "rascunho" || rmeStatus === "rejeitado";

  const load = async () => {
    if (!rmeId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_rme_pendencias_insumos", { p_rme_id: rmeId });
      if (error) throw error;
      setItems((data as Pendencia[]) || []);
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao carregar insumos." }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [rmeId]);

  const abrirDevolucao = (it: Pendencia) => {
    setTarget(it);
    setQtd(Math.max(it.quantidade - it.quantidade_devolvida, 0));
    setObs("");
    setOpen(true);
  };

  const confirmar = async () => {
    if (!user?.id || !target) return;
    if (qtd <= 0) { toast.error("Quantidade inválida."); return; }
    if (qtd > target.quantidade - target.quantidade_devolvida) {
      toast.error("Quantidade maior que o saldo."); return;
    }
    try {
      await supplyService.createDevolucao({
        saida_id: target.saida_id, quantidade: qtd, registrada_por: user.id, observacoes: obs,
      });
      toast.success("Devolução registrada — aguardando validação do BackOffice.");
      setOpen(false); setTarget(null); load();
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao registrar devolução." }); }
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
              const saldo = it.quantidade - it.quantidade_devolvida;
              return (
                <div key={it.saida_id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{it.insumo_nome || it.kit_nome || "—"}</span>
                      {it.retornavel && <Badge variant="secondary" className="text-xs"><RotateCcw className="h-3 w-3 mr-1" />Retornável</Badge>}
                      <Badge variant="outline" className="text-xs">{it.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      OS {it.numero_os} • Téc. {it.tecnico_nome} • Qtd {it.quantidade}
                      {it.quantidade_devolvida > 0 && ` • Devolvido ${it.quantidade_devolvida}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled={!podeDevolver || saldo <= 0} onClick={() => abrirDevolucao(it)}>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={confirmar}>Confirmar Devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
