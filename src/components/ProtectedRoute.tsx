import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // Verificar permissões de role
  if (roles && roles.length > 0) {
    // Se profile não tem role definido, redirecionar para auth
    if (!profile?.role) {
      return <Navigate to="/auth" />;
    }
    
    // Se role não está na lista permitida, redirecionar para home
    if (!roles.includes(profile.role)) {
      return <Navigate to="/" />;
    }
  }

  return <>{children}</>;
};