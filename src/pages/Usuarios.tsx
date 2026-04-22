import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Search, Shield, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'admin' | 'engenharia' | 'supervisao' | 'tecnico_campo' | 'cliente';
const ALL_ROLES: AppRole[] = ['admin', 'engenharia', 'supervisao', 'tecnico_campo', 'cliente'];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Administrador',
  engenharia: 'Engenharia',
  supervisao: 'Supervisor',
  tecnico_campo: 'Técnico',
  cliente: 'Cliente',
};

const ROLE_COLOR: Record<AppRole, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  engenharia: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  supervisao: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  tecnico_campo: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cliente: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
};

interface UsuarioRow {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  roles: AppRole[];
}

const Usuarios = () => {
  const { profile } = useAuth();
  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UsuarioRow | null>(null);

  const isAdmin = profile?.roles?.includes('admin');

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('id, user_id, nome, email, telefone, ativo').order('nome'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const byUser = new Map<string, AppRole[]>();
    (roles || []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) || [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    });
    setRows((profiles || []).map((p: any) => ({ ...p, roles: byUser.get(p.user_id) || [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    r.nome.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem alterar papéis.');
      return;
    }
    try {
      if (has) {
        const { error } = await supabase.from('user_roles').delete()
          .eq('user_id', userId).eq('role', role);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
        if (error) throw error;
      }
      toast.success(`Papel ${has ? 'removido' : 'atribuído'}`);
      await load();
      if (editing) {
        const updated = rows.find(r => r.user_id === userId);
        if (updated) setEditing({ ...updated, roles: has ? updated.roles.filter(r => r !== role) : [...updated.roles, role] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar papel');
    }
  };

  const toggleAtivo = async (row: UsuarioRow) => {
    try {
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
      // Remove roles first, then profile (auth.users só pode ser removido pelo admin do backend)
      await supabase.from('user_roles').delete().eq('user_id', row.user_id);
      const { error } = await supabase.from('profiles').delete().eq('id', row.id);
      if (error) throw error;
      toast.success('Usuário removido. (A conta de login deve ser excluída no backend.)');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7" /> Usuários do sistema
          </h1>
          <p className="text-muted-foreground">
            Gerencie contas, papéis e permissões. {!isAdmin && '(Visualização — apenas administradores podem editar.)'}
          </p>
        </div>
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
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{row.email}</div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {row.roles.length === 0
                        ? <Badge variant="outline" className="text-amber-700">Sem papel</Badge>
                        : row.roles.map(r => (
                            <Badge key={r} className={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Badge>
                          ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)} disabled={!isAdmin}>
                      <Shield className="h-4 w-4 mr-1" /> Papéis
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
                            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove o perfil e todos os papéis de <strong>{row.nome}</strong>.
                              A conta de login no backend precisa ser excluída separadamente.
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

      <AlertDialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Papéis de {editing?.nome}</AlertDialogTitle>
            <AlertDialogDescription>
              Marque um ou mais papéis. Um usuário pode acumular funções.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {editing && (
            <div className="space-y-3 py-4">
              {ALL_ROLES.map(role => {
                const has = editing.roles.includes(role);
                return (
                  <label key={role} className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                    <Checkbox
                      checked={has}
                      onCheckedChange={() => toggleRole(editing.user_id, role, has)}
                    />
                    <Badge className={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Badge>
                  </label>
                );
              })}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Usuarios;
