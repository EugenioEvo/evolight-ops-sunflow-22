import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Tipo {
  id: string;
  nome: string;
  descricao: string | null;
  obrigatoria: boolean;
  ativo: boolean;
}

const empty: Omit<Tipo, 'id'> = { nome: '', descricao: '', obrigatoria: false, ativo: true };

export default function HseCatalogoCertificacoes() {
  const [items, setItems] = useState<Tipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tipo | 'new' | null>(null);
  const [form, setForm] = useState<Omit<Tipo, 'id'>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('hse_certificacao_tipos').select('*').order('nome');
    if (error) toast.error(error.message);
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditing('new'); };
  const openEdit = (t: Tipo) => {
    setForm({ nome: t.nome, descricao: t.descricao ?? '', obrigatoria: t.obrigatoria, ativo: t.ativo });
    setEditing(t);
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = { ...form, nome: form.nome.trim() };
      if (editing === 'new') {
        const { error } = await supabase.from('hse_certificacao_tipos').insert(payload);
        if (error) throw error;
        toast.success('Tipo criado');
      } else if (editing) {
        const { error } = await supabase.from('hse_certificacao_tipos').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Tipo atualizado');
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Tipo) => {
    if (!confirm(`Excluir "${t.nome}"? Certificações vinculadas impedirão a exclusão.`)) return;
    const { error } = await supabase.from('hse_certificacao_tipos').delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Removido');
    load();
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Catálogo de Certificações HSE</h1>
          <p className="text-sm text-muted-foreground">Gerencie os tipos de certificação disponíveis para colaboradores e prestadores.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo tipo</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Tipos cadastrados</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {items.map(t => (
                <div key={t.id} className="flex items-center gap-3 border rounded p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.nome}</span>
                      {t.obrigatoria && <Badge variant="secondary">Obrigatória</Badge>}
                      {!t.ativo && <Badge variant="outline">Inativo</Badge>}
                    </div>
                    {t.descricao && <p className="text-xs text-muted-foreground mt-1">{t.descricao}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Novo tipo' : 'Editar tipo'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: NR-10" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.descricao ?? ''} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.obrigatoria} onCheckedChange={v => setForm({ ...form, obrigatoria: !!v })} />
              <span>Obrigatória</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.ativo} onCheckedChange={v => setForm({ ...form, ativo: !!v })} />
              <span>Ativo</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
