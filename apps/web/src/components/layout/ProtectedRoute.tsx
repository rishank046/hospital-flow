import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../common/LoadingScreen';
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
    return (
      <LoadingScreen
        message="Verifying session..."
        supportingText="Confirming secure authentication & workspace access"
      />
    );
  }

  const isDoctor = (role === 'STAFF' && staffRole === 'DOCTOR') || role === 'DOCTOR';
  const isPatientOrUser = role === 'USER' || role === 'PATIENT';

  let hasAccess = true;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!role) {
      hasAccess = false;
    } else if (allowedRoles.includes(role)) {
      hasAccess = true;
    } else if (isPatientOrUser && (allowedRoles.includes('USER') || allowedRoles.includes('PATIENT'))) {
      hasAccess = true;
    } else if (isDoctor && (allowedRoles.includes('DOCTOR') || allowedRoles.includes('STAFF'))) {
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
    const displayRole = staffRole ? `${role} • ${staffRole}` : (role ?? 'UNKNOWN');
    const returnPath = role === 'ADMIN'
      ? '/admin'
      : role === 'USER' || role === 'PATIENT'
      ? '/user'
      : staffRole === 'DOCTOR'
      ? '/staff/doctor'
      : staffRole === 'OPD_MANAGER' || staffRole === 'RECEPTIONIST'
      ? '/staff/opd'
      : staffRole === 'LAB_TECH' || staffRole === 'LAB_STAFF'
      ? '/staff/lab'
      : staffRole === 'PHARMACIST'
      ? '/staff/pharmacy'
      : staffRole === 'BILLING_CLERK'
      ? '/staff/billing'
      : staffRole === 'NURSE'
      ? '/staff/nurse'
      : '/login';

    const handleReturn = () => {
      window.history.pushState({}, '', returnPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
      <div className="forbidden-notice" style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '540px', margin: '4rem auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#dc2626' }}>
          Access Forbidden (403)
        </h2>
        <p style={{ color: '#4b5563', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Your authenticated account (<strong>{displayRole}</strong>) does not have authorization to view this area.
        </p>
        <button
          type="button"
          onClick={handleReturn}
          className="submit-button"
          style={{ maxWidth: '280px', margin: '0 auto' }}
        >
          Return to My Workspace
        </button>
      </div>
    );
  }

  return <>{children}</>;
}