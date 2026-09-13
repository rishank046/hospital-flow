import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, StaffRole, UserRole } from '../types/auth.types';
import { authService } from '../services/auth.service';

export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  staffRole: StaffRole | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, role: UserRole, user?: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('auth_token')
  );
  const [role, setRole] = useState<UserRole | null>(() => {
    const savedRole = localStorage.getItem('auth_role');
    if (
      savedRole === 'PATIENT' ||
      savedRole === 'DOCTOR' ||
      savedRole === 'STAFF' ||
      savedRole === 'ADMIN'
    ) {
      return savedRole;
    }
    return null;
  });
  const [staffRole, setStaffRole] = useState<StaffRole | null>(() => {
    const savedStaffRole = localStorage.getItem('auth_staff_role');
    if (
      savedStaffRole === 'DOCTOR' ||
      savedStaffRole === 'NURSE' ||
      savedStaffRole === 'RECEPTIONIST' ||
      savedStaffRole === 'LAB_STAFF' ||
      savedStaffRole === 'PHARMACIST'
    ) {
      return savedStaffRole;
    }
    return null;
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser) as AuthUser;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading] = useState(false);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_staff_role');
    localStorage.removeItem('auth_user');
    setToken(null);
    setRole(null);
    setStaffRole(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authService.logout().catch(() => {});
      }
    } finally {
      sessionStorage.removeItem('session_expired');
      clearAuth();
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [token, clearAuth]);

  useEffect(() => {
    const handleUnauthorized = () => {
      sessionStorage.setItem('session_expired', 'true');
      clearAuth();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [clearAuth]);

  const login = useCallback(
    (newToken: string, newRole: UserRole, userData?: Partial<AuthUser>) => {
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_role', newRole);

      if (userData?.staffRole) {
        localStorage.setItem('auth_staff_role', userData.staffRole);
        setStaffRole(userData.staffRole);
      } else {
        localStorage.removeItem('auth_staff_role');
        setStaffRole(null);
      }

      const resolvedUser: AuthUser = {
        id: userData?.id || '',
        email: userData?.email || '',
        name:
          userData?.name ||
          (newRole === 'DOCTOR'
            ? 'Doctor'
            : newRole === 'STAFF'
            ? 'Staff Member'
            : 'Patient'),
        role: newRole,
        staffRole: userData?.staffRole,
        employeeCode: userData?.employeeCode,
        specialization: userData?.specialization,
        department: userData?.department,
      };

      localStorage.setItem('auth_user', JSON.stringify(resolvedUser));
      setToken(newToken);
      setRole(newRole);
      setUser(resolvedUser);
    },
    []
  );

  const updateUser = useCallback((data: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value: AuthContextType = {
    user,
    role,
    staffRole,
    token,
    loading,
    isAuthenticated: Boolean(token && role),
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
