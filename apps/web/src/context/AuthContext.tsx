import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, UserRole } from '../types/auth.types';
import { authService } from '../services/auth.service';

export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
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
    if (savedRole === 'PATIENT' || savedRole === 'DOCTOR' || savedRole === 'ADMIN') {
      return savedRole;
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
    localStorage.removeItem('auth_user');
    setToken(null);
    setRole(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authService.logout().catch(() => {});
      }
    } finally {
      clearAuth();
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [token, clearAuth]);

  useEffect(() => {
    const handleUnauthorized = () => {
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

      const resolvedUser: AuthUser = {
        id: userData?.id || '',
        email: userData?.email || '',
        name: userData?.name || (newRole === 'DOCTOR' ? 'Doctor' : 'Patient'),
        role: newRole,
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
    token,
    loading,
    isAuthenticated: Boolean(token && role),
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
