import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Shield, Trash2, UserCog, Pencil, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { especialidadesOptions, certificacoesOptions, experienciaOptions } from '@/features/providers/types';

type AppRole = 'admin' | 'engenharia' | 'supervisao' | 'backoffice' | 'tecnico_campo' | 'cliente';
const ALL_ROLES: AppRole[] = ['admin', 'engenharia', 'supervisao', 'backoffice', 'tecnico_campo', 'cliente'];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Administrador',
  engenharia: 'Engenharia',
  supervisao: 'Supervisor',
  backoffice: 'BackOffice',
  tecnico_campo: 'Técnico',
  cliente: 'Cliente',
};

const ROLE_COLOR: Record<AppRole, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  engenharia: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  supervisao: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  backoffice: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  tecnico_campo: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cliente: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
};

interface PrestadorData {
  id: string;
  cpf: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  endereco: string | null;
  experiencia: string | null;
  especialidades: string[] | null;
  certificacoes: string[] | null;
  observacoes_candidato: string | null;
}

interface UsuarioRow {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  roles: AppRole[];
  prestador: PrestadorData | null;
}

const Usuarios = () => {
  const { profile } = useAuth();
  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const isAdmin = profile?.roles?.includes('admin');

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: tecnicos }, { data: prestadores }] = await Promise.all([
      supabase.from('profiles').select('id, user_id, nome, email, telefone, ativo').order('nome'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('tecnicos').select('profile_id, prestador_id'),
      supabase.from('prestadores').select('id, email, cpf, cidade, estado, cep, endereco, experiencia, especialidades, certificacoes, observacoes_candidato'),
    ]);

    const rolesByUser = new Map<string, AppRole[]>();
    (roles || []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) || [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    const prestadorById = new Map<string, PrestadorData>();
    const prestadorByEmail = new Map<string, PrestadorData>();
    (prestadores || []).forEach((p: any) => {
      prestadorById.set(p.id, p);
      prestadorByEmail.set(p.email.toLowerCase(), p);
    });

    const prestadorIdByProfile = new Map<string, string>();
    (tecnicos || []).forEach((t: any) => {
      if (t.prestador_id) prestadorIdByProfile.set(t.profile_id, t.prestador_id);
    });

    setRows((profiles || []).map((p: any) => {
      const fkPrestadorId = prestadorIdByProfile.get(p.id);
      const prestador = fkPrestadorId
        ? prestadorById.get(fkPrestadorId) ?? null
        : prestadorByEmail.get(p.email.toLowerCase()) ?? null;
      return { ...p, roles: rolesByUser.get(p.user_id) || [], prestador };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r =>
    r.nome.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  const toggleAtivo = async (row: UsuarioRow) => {
    try {
      // Trigger replicates to prestadores automatically.
      const { error } = await supabase.from('profiles')
        .update({ ativo: !row.ativo }).eq('id', row.id);
      if (error) throw error;
      toast.success(`Usuário ${!row.ativo ? 'ativado' : 'desativado'}`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Erro');
    }
  };

  const remove = async (row: UsuarioRow) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: row.user_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Usuário excluído (perfil, papéis e conta de login).');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7" /> Usuários do sistema
          </h1>
          <p className="text-muted-foreground">
            Gerencie contas, papéis e permissões. {!isAdmin && '(Visualização — apenas administradores podem editar.)'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo usuário staff
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando usuários...</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(row => (
            <Card key={row.id} className={!row.ativo ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{row.nome}</span>
                      {!row.ativo && <Badge variant="outline">Inativo</Badge>}
                      {row.prestador && <Badge variant="secondary" className="text-xs">Prestador vinculado</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{row.email}</div>
                    {row.telefone && <div className="text-xs text-muted-foreground">{row.telefone}</div>}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {row.roles.length === 0
                        ? <Badge variant="outline" className="text-warning">Sem papel</Badge>
                        : row.roles.map(r => (
                            <Badge key={r} className={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Badge>
                          ))}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)} disabled={!isAdmin}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleAtivo(row)} disabled={!isAdmin}>
                      {row.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                            <AlertDialogDescription>
                              Exclui permanentemente <strong>{row.nome}</strong>: perfil, papéis e a conta de login no backend.
                              Se houver prestador vinculado, ele será mantido como histórico (inativo). Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(row)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</Card>
          )}
        </div>
      )}

      <EditUserDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { await load(); }}
        saving={saving}
        setSaving={setSaving}
      />

      <CreateStaffDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => { await load(); }}
      />
    </div>
  );
};

export default Usuarios;

// =============================================================
// Edit dialog (full): basics + roles + prestador (when linked)
// =============================================================
interface EditDialogProps {
  editing: UsuarioRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  saving: boolean;
  setSaving: (v: boolean) => void;
}

const EditUserDialog = ({ editing, onClose, onSaved, saving, setSaving }: EditDialogProps) => {
  const [form, setForm] = useState<UsuarioRow | null>(null);

  useEffect(() => {
    setForm(editing ? JSON.parse(JSON.stringify(editing)) : null);
  }, [editing]);

  if (!form) return null;

  const updateBase = (key: keyof UsuarioRow, value: any) => setForm({ ...form, [key]: value });
  const updatePrestador = (key: keyof PrestadorData, value: any) =>
    form.prestador && setForm({ ...form, prestador: { ...form.prestador, [key]: value } });

  const toggleArrayItem = (arr: string[] | null, item: string) => {
    const set = new Set(arr || []);
    set.has(item) ? set.delete(item) : set.add(item);
    return Array.from(set);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // 1. Profile (triggers will replicate to prestadores)
      const { error: profErr } = await supabase.from('profiles').update({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone?.trim() || null,
        ativo: form.ativo,
      }).eq('id', form.id);
      if (profErr) throw profErr;

      // 2. Prestador-specific fields (only operational/identity fields not in profile)
      if (form.prestador) {
        const { error: pErr } = await supabase.from('prestadores').update({
          cpf: form.prestador.cpf?.trim() || null,
          cidade: form.prestador.cidade?.trim() || null,
          estado: form.prestador.estado?.trim() || null,
          cep: form.prestador.cep?.trim() || null,
          endereco: form.prestador.endereco?.trim() || null,
          experiencia: form.prestador.experiencia || null,
          especialidades: form.prestador.especialidades || [],
          certificacoes: form.prestador.certificacoes || [],
          observacoes_candidato: form.prestador.observacoes_candidato?.trim() || null,
        }).eq('id', form.prestador.id);
        if (pErr) throw pErr;
      }

      // 3. Roles diff
      const before = new Set(editing.roles);
      const after = new Set(form.roles);
      const toAdd = [...after].filter(r => !before.has(r));
      const toRemove = [...before].filter(r => !after.has(r));

      for (const role of toAdd) {
        const { error } = await supabase.from('user_roles').insert({ user_id: form.user_id, role });
        if (error) throw error;
      }
      for (const role of toRemove) {
        const { error } = await supabase.from('user_roles').delete()
          .eq('user_id', form.user_id).eq('role', role);
        if (error) throw error;
      }

      toast.success('Usuário atualizado');
      await onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!editing} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Alterações em nome, e-mail, telefone e status são sincronizadas automaticamente com o cadastro de Prestador (quando vinculado).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Basic */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados básicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.nome} onChange={e => updateBase('nome', e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => updateBase('email', e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone || ''} onChange={e => updateBase('telefone', e.target.value)} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                  <Checkbox checked={form.ativo} onCheckedChange={v => updateBase('ativo', !!v)} />
                  <span>Usuário ativo</span>
                </label>
              </div>
            </div>
          </section>

          {/* Roles */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Papéis (roles)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_ROLES.map(role => {
                const has = form.roles.includes(role);
                return (
                  <label key={role} className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 rounded border">
                    <Checkbox
                      checked={has}
                      onCheckedChange={() =>
                        updateBase('roles', has ? form.roles.filter(r => r !== role) : [...form.roles, role])
                      }
                    />
                    <Badge className={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Badge>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Prestador (only when linked) */}
          {form.prestador ? (
            <section className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados do prestador vinculado</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>CPF</Label>
                  <Input value={form.prestador.cpf || ''} onChange={e => updatePrestador('cpf', e.target.value)} />
                </div>
                <div>
                  <Label>Experiência</Label>
                  <Select
                    value={form.prestador.experiencia || ''}
                    onValueChange={v => updatePrestador('experiencia', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {experienciaOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.prestador.cidade || ''} onChange={e => updatePrestador('cidade', e.target.value)} />
                </div>
                <div>
                  <Label>Estado (UF)</Label>
                  <Input maxLength={2} value={form.prestador.estado || ''}
                    onChange={e => updatePrestador('estado', e.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.prestador.cep || ''} onChange={e => updatePrestador('cep', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.prestador.endereco || ''} onChange={e => updatePrestador('endereco', e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Especialidades</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {especialidadesOptions.map(opt => {
                    const checked = form.prestador!.especialidades?.includes(opt) || false;
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            updatePrestador('especialidades', toggleArrayItem(form.prestador!.especialidades, opt))
                          }
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Certificações</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {certificacoesOptions.map(opt => {
                    const checked = form.prestador!.certificacoes?.includes(opt) || false;
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer min-h-[36px]">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            updatePrestador('certificacoes', toggleArrayItem(form.prestador!.certificacoes, opt))
                          }
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Observações do candidato</Label>
                <Textarea
                  rows={3}
                  value={form.prestador.observacoes_candidato || ''}
                  onChange={e => updatePrestador('observacoes_candidato', e.target.value)}
                />
              </div>
            </section>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Este usuário não tem prestador vinculado (admin/engenharia). Apenas dados básicos e papéis.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =============================================================
// Create staff dialog (admin / engenharia only)
// =============================================================
interface CreateDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => Promise<void>;
}

const CreateStaffDialog = ({ open, onOpenChange, onCreated }: CreateDialogProps) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [role, setRole] = useState<'admin' | 'engenharia'>('engenharia');
  const [loading, setLoading] = useState(false);

  const reset = () => { setNome(''); setEmail(''); setTelefone(''); setRole('engenharia'); };

  const handleSubmit = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          telefone: telefone.trim() || undefined,
          role,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      toast.success(data?.message || 'Usuário criado');
      reset();
      onOpenChange(false);
      await onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!loading) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário staff</DialogTitle>
          <DialogDescription>
            Disponível apenas para <strong>Administrador</strong> e <strong>Engenharia</strong>.
            Técnicos e supervisores são criados pela aprovação de candidatura em /prestadores.
            Um convite por e-mail será enviado para definir a senha.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@evolight.com" />
          </div>
          <div>
            <Label>Telefone (opcional)</Label>
            <Input value={telefone} onChange={e => setTelefone(e.target.value)} />
          </div>
          <div>
            <Label>Papel</Label>
            <Select value={role} onValueChange={v => setRole(v as 'admin' | 'engenharia')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="engenharia">Engenharia</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar e enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
