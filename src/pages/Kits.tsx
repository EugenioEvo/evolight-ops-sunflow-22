import { useEffect, useState } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supplyService } from "@/features/supplies";
import type { Kit, Insumo } from "@/features/supplies";
import { supabase } from "@/integrations/supabase/client";
import { useErrorHandler } from "@/hooks/useErrorHandler";

export default function Kits() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itens, setItens] = useState<Array<{ insumo_id: string; quantidade: number }>>([]);
  const { handleError } = useErrorHandler();

  const load = async () => {
    setLoading(true);
    try {
      const [k, ins] = await Promise.all([
        supplyService.loadKits(),
        supabase.from("insumos").select("*").order("nome"),
      ]);
      setKits(k as Kit[]);
      setInsumos((ins.data as any) || []);
    } catch (e) {
      handleError(e, { fallbackMessage: "Erro ao carregar KITs." });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addItem = () => setItens([...itens, { insumo_id: "", quantidade: 1 }]);
  const removeItem = (i: number) => setItens(itens.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<{ insumo_id: string; quantidade: number }>) =>
    setItens(itens.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const reset = () => { setNome(""); setDescricao(""); setItens([]); };

  const submit = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do KIT."); return; }
    const valid = itens.filter(i => i.insumo_id && i.quantidade > 0);
    if (valid.length === 0) { toast.error("Adicione ao menos um item."); return; }
    try {
      await supplyService.createKit({ nome, descricao, itens: valid });
      toast.success("KIT criado!");
      setOpen(false); reset(); load();
    } catch (e) { handleError(e, { fallbackMessage: "Erro ao criar KIT." }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este KIT?")) return;
    try { await supplyService.deleteKit(id); toast.success("KIT excluído."); load(); }
    catch (e) { handleError(e, { fallbackMessage: "Erro ao excluir KIT." }); }
  };

  if (loading) return <div className="container mx-auto py-8"><div className="text-center">Carregando...</div></div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">KITs de Insumos</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo KIT</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Novo KIT</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Itens</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
                </div>
                {itens.map((it, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select value={it.insumo_id} onValueChange={(v) => updateItem(i, { insumo_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione o insumo" /></SelectTrigger>
                        <SelectContent>
                          {insumos.map(ins => <SelectItem key={ins.id} value={ins.id}>{ins.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input type="number" min="1" className="w-24" value={it.quantidade}
                      onChange={(e) => updateItem(i, { quantidade: parseInt(e.target.value) || 1 })} />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {itens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit}>Criar KIT</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kits.map(kit => (
          <Card key={kit.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2"><Package className="h-4 w-4" /><CardTitle className="text-lg">{kit.nome}</CardTitle></div>
                <Button size="sm" variant="ghost" onClick={() => remove(kit.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {kit.descricao && <p className="text-sm text-muted-foreground">{kit.descricao}</p>}
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(kit.kit_itens || []).map(it => (
                  <div key={it.id} className="flex justify-between text-sm">
                    <span>{it.insumo?.nome || "—"}</span>
                    <Badge variant="outline">{it.quantidade} {it.insumo?.unidade || ""}</Badge>
                  </div>
                ))}
                {(kit.kit_itens || []).length === 0 && <p className="text-sm text-muted-foreground">Sem itens.</p>}
              </div>
            </CardContent>
          </Card>
        ))}
        {kits.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum KIT cadastrado.</div>
        )}
      </div>
    </div>
  );
}
