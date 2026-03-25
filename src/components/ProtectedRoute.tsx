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

  useEffect(() => {
    const checkApproval = async () => {
      if (!profile || profile.role !== 'tecnico_campo') {
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
  }, [profile, loading]);

  if (loading || (profile?.role === 'tecnico_campo' && approvalStatus === 'loading')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // Tecnico pending approval
  if (profile?.role === 'tecnico_campo' && approvalStatus === 'pending') {
    return <PendingApproval />;
  }

  // Verificar permissões de role
  if (roles && roles.length > 0) {
    if (!profile?.role) {
      return <Navigate to="/auth" />;
    }
    
    if (!roles.includes(profile.role)) {
      return <Navigate to="/" />;
    }
  }

  return <>{children}</>;
};
