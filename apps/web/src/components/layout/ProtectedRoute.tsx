import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Array<'PATIENT' | 'DOCTOR' | 'ADMIN'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role, loading } = useAuth();

  useEffect(() => {
    const handleUnauthorized = () => {
      sessionStorage.setItem('session_expired', 'true');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [loading, isAuthenticated]);

  if (loading || !isAuthenticated) {
    return <div className="loading-screen">Loading session...</div>;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return (
      <div className="forbidden-notice">
        <h2>Access Forbidden (403)</h2>
        <p>
          Your account ({role ?? 'UNKNOWN'}) does not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}