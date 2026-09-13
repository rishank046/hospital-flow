import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Array<'PATIENT' | 'DOCTOR' | 'ADMIN'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role, loading } = useAuth();
  const is401Ref = useRef(false);

  useEffect(() => {
    const handleUnauthorized = () => {
      is401Ref.current = true;
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  if (loading) {
    return <div className="loading-screen">Loading session...</div>;
  }

  if (!isAuthenticated) {
    if (is401Ref.current || sessionStorage.getItem('session_expired') === 'true') {
      sessionStorage.setItem('session_expired', 'true');
    }
    window.location.href = '/login';
    return null;
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
