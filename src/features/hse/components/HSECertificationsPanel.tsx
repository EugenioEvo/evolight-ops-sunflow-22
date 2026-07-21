import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Camera, Image as ImageIcon, FileText, Download, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  /** Exatamente um dos dois deve ser fornecido */
  profileId?: string | null;
  prestadorId?: string | null;
}

interface Tipo { id: string; nome: string; ativo: boolean; }
interface Anexo { id: string; storage_path: string; nome_original: string | null; mime_type: string | null; }
interface Cert {
  id: string;
  tipo_id: string;
  tipo_nome: string;
  data_vencimento: string | null;
  observacoes: string | null;
  origem: 'manual' | 'migrado_legado';
  anexos: Anexo[];
}

const BUCKET = 'hse-certificacoes';

const statusOf = (venc: string | null): { label: string; cls: string } => {
  if (!venc) return { label: 'Sem vencimento', cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' };
  const d = new Date(venc + 'T00:00:00');
  const days = Math.floor((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `Vencida (${Math.abs(days)}d)`, cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' };
  if (days <= 30) return { label: `Vence em ${days}d`, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
  return { label: `OK (${days}d)`, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' };
};

const isImg = (n: string) => /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(n);
const isVid = (n: string) => /\.(mp4|webm|mov|m4v|avi|mkv|3gp|quicktime)$/i.test(n);

export function HSECertificationsPanel({ profileId, prestadorId }: Props) {
  const { profile } = useAuth();
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Cert | 'new' | null>(null);

  const ownerColumn = profileId ? 'profile_id' : 'prestador_id';
  const ownerId = profileId || prestadorId;

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [tiposRes, certRes] = await Promise.all([
        supabase.from('hse_certificacao_tipos').select('id, nome, ativo').eq('ativo', true).order('nome'),
        supabase
          .from('hse_certificacoes')
          .select('id, tipo_id, data_vencimento, observacoes, origem, hse_certificacao_tipos!inner(nome), hse_certificacao_anexos(id, storage_path, nome_original, mime_type)')
          .eq(ownerColumn, ownerId)
          .order('created_at', { ascending: false }),
      ]);
      if (tiposRes.error) throw tiposRes.error;
      if (certRes.error) throw certRes.error;
      setTipos(tiposRes.data || []);
      setCerts(
        (certRes.data || []).map((r: any) => ({
          id: r.id,
          tipo_id: r.tipo_id,
          tipo_nome: r.hse_certificacao_tipos?.nome ?? '—',
          data_vencimento: r.data_vencimento,
          observacoes: r.observacoes,
          origem: r.origem,
          anexos: r.hse_certificacao_anexos || [],
        }))
      );
    } catch (e: any) {
      toast.error('Erro ao carregar certificações: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ownerId]);

  if (!ownerId) {
    return <p className="text-sm text-muted-foreground">Salve o cadastro antes de anexar certificações.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Certificações HSE</h3>
        <Button type="button" size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-1" /> Nova certificação
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : certs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma certificação cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {certs.map(c => {
            const st = statusOf(c.data_vencimento);
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.tipo_nome}</span>
                      <Badge className={st.cls} variant="secondary">{st.label}</Badge>
                      {c.origem === 'migrado_legado' && !c.data_vencimento && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Pendente de complemento
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {c.data_vencimento ? `Vence em ${new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'Sem data'}
                      </span>
                      <span className="text-xs text-muted-foreground">• {c.anexos.length} anexo(s)</span>
                    </div>
                    {c.observacoes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.observacoes}</p>}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <CertDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          onSaved={load}
          tipos={tipos}
          profileId={profileId ?? null}
          prestadorId={prestadorId ?? null}
          initial={editing === 'new' ? null : editing}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------
interface DialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  tipos: Tipo[];
  profileId: string | null;
  prestadorId: string | null;
  initial: Cert | null;
}

function CertDialog({ open, onClose, onSaved, tipos, profileId, prestadorId, initial }: DialogProps) {
  const { user } = useAuth();
  const [tipoId, setTipoId] = useState(initial?.tipo_id ?? '');
  const [vencimento, setVencimento] = useState(initial?.data_vencimento ?? '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [anexos, setAnexos] = useState<Anexo[]>(initial?.anexos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [certId, setCertId] = useState<string | null>(initial?.id ?? null);

  // Precisamos do id da cert para anexar arquivos (path convention: <cert_id>/…).
  // Se for nova, criamos um "rascunho" logo na primeira interação (upload) ou no save.
  const ensureCertId = async (): Promise<string> => {
    if (certId) return certId;
    if (!tipoId) throw new Error('Selecione um tipo de certificação antes de anexar.');
    const payload: any = {
      tipo_id: tipoId,
      profile_id: profileId,
      prestador_id: prestadorId,
      data_vencimento: vencimento || null,
      observacoes: observacoes || null,
      origem: 'manual',
      created_by: user?.id ?? null,
    };
    const { data, error } = await supabase.from('hse_certificacoes').insert(payload).select('id').single();
    if (error) throw error;
    setCertId(data.id);
    return data.id;
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const id = await ensureCertId();
      const uploaded: Anexo[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: rec, error: recErr } = await supabase
          .from('hse_certificacao_anexos')
          .insert({
            certificacao_id: id,
            storage_path: path,
            nome_original: file.name,
            mime_type: file.type || null,
            tamanho_bytes: file.size,
            uploaded_by: user?.id ?? null,
          })
          .select('id, storage_path, nome_original, mime_type')
          .single();
        if (recErr) throw recErr;
        uploaded.push(rec as Anexo);
      }
      setAnexos(prev => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} arquivo(s) anexado(s)`);
    } catch (e: any) {
      toast.error('Erro no upload: ' + e.message);
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const removeAnexo = async (a: Anexo) => {
    if (!confirm('Remover este anexo?')) return;
    try {
      await supabase.storage.from(BUCKET).remove([a.storage_path]);
      const { error } = await supabase.from('hse_certificacao_anexos').delete().eq('id', a.id);
      if (error) throw error;
      setAnexos(prev => prev.filter(x => x.id !== a.id));
    } catch (e: any) {
      toast.error('Erro ao remover anexo: ' + e.message);
    }
  };

  const openAnexo = async (a: Anexo) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error('Erro ao gerar link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const save = async () => {
    if (!tipoId) { toast.error('Selecione o tipo'); return; }
    setSaving(true);
    try {
      const payload: any = {
        tipo_id: tipoId,
        data_vencimento: vencimento || null,
        observacoes: observacoes || null,
      };
      if (certId) {
        // Editing existing OR draft
        payload.origem = initial?.origem === 'migrado_legado' && vencimento ? 'manual' : (initial?.origem ?? 'manual');
        const { error } = await supabase.from('hse_certificacoes').update(payload).eq('id', certId);
        if (error) throw error;
      } else {
        payload.profile_id = profileId;
        payload.prestador_id = prestadorId;
        payload.origem = 'manual';
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from('hse_certificacoes').insert(payload);
        if (error) throw error;
      }
      toast.success('Certificação salva');
      await onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeCert = async () => {
    if (!certId) { onClose(); return; }
    if (!confirm('Excluir esta certificação e todos os seus anexos?')) return;
    setDeleting(true);
    try {
      // Remove storage files
      if (anexos.length > 0) {
        await supabase.storage.from(BUCKET).remove(anexos.map(a => a.storage_path));
      }
      const { error } = await supabase.from('hse_certificacoes').delete().eq('id', certId);
      if (error) throw error;
      toast.success('Certificação removida');
      await onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Erro ao remover: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar certificação' : 'Nova certificação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {tipos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data de vencimento</Label>
            <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Anexos ({anexos.length})</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => galleryRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-1" /> Galeria
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => cameraRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-1" /> Câmera
                </Button>
              </div>
            </div>
            <input ref={galleryRef} type="file" accept="*/*" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={e => uploadFiles(e.target.files)} />
            {uploading && <p className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 mr-1 animate-spin" /> Enviando…</p>}

            {anexos.length > 0 && (
              <div className="space-y-1 mt-2 max-h-52 overflow-y-auto">
                {anexos.map(a => {
                  const nome = a.nome_original || a.storage_path.split('/').pop() || 'arquivo';
                  const Ico = isImg(nome) ? ImageIcon : isVid(nome) ? Camera : FileText;
                  return (
                    <div key={a.id} className="flex items-center gap-2 text-sm border rounded p-2">
                      <Ico className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{nome}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => openAnexo(a)}><Download className="h-4 w-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeAnexo(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {certId && (
            <Button type="button" variant="destructive" onClick={removeCert} disabled={deleting} className="sm:mr-auto">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />} Excluir
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving || !tipoId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
