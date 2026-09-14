import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, StaffInfo, StaffRole, UserRole } from '../types/auth.types';
import { authService } from '../services/auth.service';

export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  staff: StaffInfo | null;
  staffRole: StaffRole | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (
    token: string,
    roleOrUser: UserRole | AuthUser,
    userOrStaff?: Partial<AuthUser> | StaffInfo | null
  ) => void;
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
      savedRole === 'USER' ||
      savedRole === 'STAFF' ||
      savedRole === 'ADMIN' ||
      savedRole === 'PATIENT' ||
      savedRole === 'DOCTOR'
    ) {
      return savedRole as UserRole;
    }
    return null;
  });

  const [staffRole, setStaffRole] = useState<StaffRole | null>(() => {
    const savedStaffRole = localStorage.getItem('auth_staff_role');
    if (savedStaffRole) {
      return savedStaffRole as StaffRole;
    }
    return null;
  });

  const [staff, setStaff] = useState<StaffInfo | null>(() => {
    const savedStaff = localStorage.getItem('auth_staff');
    if (savedStaff) {
      try {
        return JSON.parse(savedStaff) as StaffInfo;
      } catch {
        return null;
      }
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

  const [loading, setLoading] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('auth_token'));
  });

  const clearAuth = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_staff_role');
    localStorage.removeItem('auth_staff');
    localStorage.removeItem('auth_user');
    setToken(null);
    setRole(null);
    setStaffRole(null);
    setStaff(null);
    setUser(null);
  }, []);

  // Session verification and initialization on app startup
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    authService
      .me()
      .then((response) => {
        if (!isMounted) return;
        const verifiedUser = response.data?.user || response.user;
        const verifiedStaff = response.data?.staff || response.staff || null;

        if (verifiedUser) {
          const userRole = verifiedUser.role as UserRole;
          const resolvedStaffRole = (verifiedStaff?.staffRole || verifiedStaff?.role || verifiedUser.staffRole) as StaffRole | undefined;

          setUser(verifiedUser);
          setRole(userRole);
          setStaff(verifiedStaff);
          setStaffRole(resolvedStaffRole ?? null);

          localStorage.setItem('auth_user', JSON.stringify(verifiedUser));
          localStorage.setItem('auth_role', userRole);
          if (verifiedStaff) {
            localStorage.setItem('auth_staff', JSON.stringify(verifiedStaff));
          } else {
            localStorage.removeItem('auth_staff');
          }
          if (resolvedStaffRole) {
            localStorage.setItem('auth_staff_role', resolvedStaffRole);
          } else {
            localStorage.removeItem('auth_staff_role');
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        sessionStorage.setItem('session_expired', 'true');
        clearAuth();
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.history.pushState({}, '', '/login');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clearAuth]);

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
    (
      newToken: string,
      roleOrUser: UserRole | AuthUser,
      userOrStaff?: Partial<AuthUser> | StaffInfo | null
    ) => {
      localStorage.setItem('auth_token', newToken);
      setToken(newToken);

      let resolvedUser: AuthUser;
      let resolvedStaff: StaffInfo | null = null;

      if (typeof roleOrUser === 'string') {
        // Legacy overload: login(token, role, user)
        const legacyRole = roleOrUser;
        const legacyUser = userOrStaff as Partial<AuthUser> | undefined;
        resolvedUser = {
          id: legacyUser?.id || '',
          email: legacyUser?.email || '',
          name:
            legacyUser?.name ||
            (legacyRole === 'DOCTOR' || (legacyRole === 'STAFF' && legacyUser?.staffRole === 'DOCTOR')
              ? 'Doctor'
              : legacyRole === 'STAFF'
              ? 'Staff Member'
              : legacyRole === 'ADMIN'
              ? 'Administrator'
              : 'User'),
          role: legacyRole,
          staffRole: legacyUser?.staffRole,
          employeeCode: legacyUser?.employeeCode,
          specialization: legacyUser?.specialization,
          department: legacyUser?.department,
        };

        if (legacyUser?.staffRole) {
          resolvedStaff = {
            id: '',
            staffRole: legacyUser.staffRole,
            role: legacyUser.staffRole,
            employeeCode: legacyUser.employeeCode,
            department: legacyUser.department,
          };
        }
      } else {
        // Modern overload: login(token, user, staff)
        resolvedUser = roleOrUser;
        resolvedStaff = (userOrStaff as StaffInfo | null) || null;
      }

      const effectiveRole = resolvedUser.role;
      const effectiveStaffRole = resolvedStaff?.staffRole || resolvedStaff?.role || resolvedUser.staffRole || null;

      localStorage.setItem('auth_role', effectiveRole);
      setRole(effectiveRole);

      localStorage.setItem('auth_user', JSON.stringify(resolvedUser));
      setUser(resolvedUser);

      if (resolvedStaff) {
        localStorage.setItem('auth_staff', JSON.stringify(resolvedStaff));
        setStaff(resolvedStaff);
      } else {
        localStorage.removeItem('auth_staff');
        setStaff(null);
      }

      if (effectiveStaffRole) {
        localStorage.setItem('auth_staff_role', effectiveStaffRole);
        setStaffRole(effectiveStaffRole);
      } else {
        localStorage.removeItem('auth_staff_role');
        setStaffRole(null);
      }
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
    staff,
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
