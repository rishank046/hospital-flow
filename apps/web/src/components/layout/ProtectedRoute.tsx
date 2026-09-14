import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { StaffRole, UserRole } from '../../types/auth.types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Array<UserRole>;
  allowedStaffRoles?: Array<StaffRole>;
}

export function ProtectedRoute({ children, allowedRoles, allowedStaffRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role, staffRole, loading } = useAuth();

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

  const isDoctor = role === 'DOCTOR' || (role === 'STAFF' && staffRole === 'DOCTOR');

  let hasAccess = true;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!role) {
      hasAccess = false;
    } else if (allowedRoles.includes(role)) {
      hasAccess = true;
    } else if (isDoctor && allowedRoles.includes('DOCTOR')) {
      hasAccess = true;
    } else if (isDoctor && allowedRoles.includes('STAFF')) {
      hasAccess = true;
    } else {
      hasAccess = false;
    }
  }

  if (hasAccess && allowedStaffRoles && allowedStaffRoles.length > 0) {
    if (role !== 'STAFF' || !staffRole || !allowedStaffRoles.includes(staffRole)) {
      hasAccess = false;
    }
  }

  if (!hasAccess) {
    const displayRole = staffRole ? `${role} (${staffRole})` : (role ?? 'UNKNOWN');
    return (
      <div className="forbidden-notice">
        <h2>Access Forbidden (403)</h2>
        <p>
          Your account ({displayRole}) does not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}