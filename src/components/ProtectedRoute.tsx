import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PendingApproval from '@/pages/PendingApproval';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState<'loading' | 'approved' | 'pending'>('loading');

  // Multi-role: o gate de "aprovação pendente" só se aplica quando o usuário é
  // EXCLUSIVAMENTE tecnico_campo. Se acumular staff (admin/eng/supervisao), o login
  // é liberado pela role de staff — não faz sentido bloquear um supervisor pelo
  // status do prestador.
  const isStaff = !!profile?.roles?.some((r) =>
    r === 'admin' || r === 'engenharia' || r === 'supervisao'
  );
  const isTecnicoOnly = !!profile?.roles?.includes('tecnico_campo') && !isStaff;

  useEffect(() => {
    const checkApproval = async () => {
      if (!profile || !isTecnicoOnly) {
        setApprovalStatus('approved');
        return;
      }

      // Check if the prestador linked to this email is active
      const { data, error } = await supabase
        .from('prestadores')
        .select('ativo')
        .eq('email', profile.email)
        .maybeSingle();

      if (error || !data) {
        // No prestador found - might be legacy, allow access
        setApprovalStatus('approved');
        return;
      }

      setApprovalStatus(data.ativo ? 'approved' : 'pending');
    };

    if (profile) {
      checkApproval();
    } else if (!loading) {
      setApprovalStatus('approved');
    }
  }, [profile, loading, isTecnicoOnly]);

  if (loading || (isTecnicoOnly && approvalStatus === 'loading')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // Profile still loading after auth resolved
  if (!profile && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Tecnico-only pending approval
  if (isTecnicoOnly && approvalStatus === 'pending') {
    return <PendingApproval />;
  }

  // Verificar permissões de role — considera TODAS as roles do usuário (multi-role).
  // Basta uma das roles do user estar na lista permitida da rota.
  if (roles && roles.length > 0) {
    const userRoles = profile?.roles ?? (profile?.role ? [profile.role] : []);
    if (userRoles.length === 0) {
      return <Navigate to="/auth" />;
    }
    const allowed = userRoles.some((r) => roles.includes(r));
    if (!allowed) {
      return <Navigate to="/" />;
    }
  }

  return <>{children}</>;
};
