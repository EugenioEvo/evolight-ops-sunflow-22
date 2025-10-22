import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const attemptedProfileCreationRef = useRef(false);

  const fetchProfile = async (userId: string, maxAttempts = 10) => {
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Buscar perfil com dados relacionados
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            *,
            clientes(*),
            tecnicos(*)
          `)
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar perfil:', error);
        }

        // Se não existe perfil na primeira tentativa, criar
        if (!data && attempt === 0 && !attemptedProfileCreationRef.current) {
          attemptedProfileCreationRef.current = true;
          try {
            await supabase.functions.invoke('create-user-profile');
            // Continuar para próxima tentativa
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
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
            setProfile({ ...data, role: roleData.role });
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
            setProfile({ ...data, role: roleData?.role || 'cliente' });
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
          fetchProfile(session.user!.id);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
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