export type AccountRole = 'USER' | 'STAFF' | 'ADMIN';
export type UserRole = AccountRole | 'PATIENT' | 'DOCTOR';

export type StaffRole =
  | 'DOCTOR'
  | 'OPD_MANAGER'
  | 'NURSE'
  | 'LAB_TECH'
  | 'PHARMACIST'
  | 'RECEPTIONIST'
  | 'BILLING_CLERK'
  | 'LAB_STAFF';

export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export interface StaffInfo {
  id: string;
  staffRole: StaffRole;
  role?: StaffRole;
  employeeCode?: string;
  status?: StaffStatus;
  department?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  staffRole?: StaffRole;
  employeeCode?: string;
  specialization?: string;
  department?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  success?: boolean;
  message?: string;
  data?: {
    token: string;
    user: AuthUser;
    staff: StaffInfo | null;
    doctor?: {
      id: string;
      name?: string;
      email?: string;
      specialization?: string;
      department?: string;
    } | null;
  };
  token?: string;
  user?: AuthUser;
  staff?: StaffInfo | null;
  doctor?: {
    id: string;
    name?: string;
    email?: string;
    specialization?: string;
    department?: string;
  } | null;
}
