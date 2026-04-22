import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'engenharia' | 'supervisao' | 'tecnico_campo' | 'cliente';

// Ordem de prioridade para resolver a "role principal" (UI/redirect)
// quando um usuário acumula múltiplas roles. Quanto menor o índice, maior a prioridade.
const ROLE_PRIORITY: AppRole[] = ['admin', 'engenharia', 'supervisao', 'tecnico_campo', 'cliente'];

const pickPrimaryRole = (roles: AppRole[]): AppRole | undefined => {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
};

interface UserProfile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  /** Role principal (maior prioridade entre as acumuladas). Mantida para compatibilidade. */
  role?: AppRole;
  /** Lista completa de roles do usuário. Use para checks operacionais (ex: "é técnico?"). */
  roles?: AppRole[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const attemptedProfileCreationRef = useRef(false);

  const fetchProfile = async (userId: string, maxAttempts = 10) => {
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Buscar perfil SEM relações aninhadas para evitar recursão de RLS
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar perfil:', error);
        }

        // Se não existe perfil na primeira tentativa, criar (só se tiver sessão)
        if (!data && attempt === 0 && !attemptedProfileCreationRef.current) {
          attemptedProfileCreationRef.current = true;
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await supabase.functions.invoke('create-user-profile', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`
                }
              });
              // Continuar para próxima tentativa
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
          } catch (fnErr) {
            console.error('Erro ao criar perfil automaticamente:', fnErr);
          }
        }

        // Se encontrou o perfil, buscar role separadamente
        if (data) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();

          // Se tem role, sucesso!
          if (roleData?.role) {
            setProfile({ ...data, role: roleData.role as UserProfile['role'] });
            return;
          }

          // Se não tem role ainda e não é última tentativa, aguardar
          if (!roleData?.role && attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          // Última tentativa sem role - permitir acesso como cliente
          if (attempt === maxAttempts - 1) {
            console.warn('Profile encontrado mas role não foi carregado após 10 tentativas. Usando perfil sem role.');
            // Define role padrão como cliente se não foi carregado
            setProfile({ ...data, role: (roleData?.role || 'cliente') as UserProfile['role'] });
            return;
          }
        }

        // Se não tem dados, aguardar antes da próxima tentativa
        if (!data && attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Após todas as tentativas, se não encontrou nada
      setProfile(null);
    } catch (error) {
      console.error('Erro ao buscar/criar perfil:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user!.id).finally(() => setLoading(false));
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};