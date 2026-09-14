export type StaffRole = 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' | 'LAB_STAFF' | 'PHARMACIST' | 'LAB_TECH' | 'BILLING_CLERK';
export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type UserRole = 'PATIENT' | 'DOCTOR' | 'STAFF' | 'ADMIN';
export type AccountType = 'patient' | 'doctor' | 'staff';
export type AuthMode = 'login' | 'register';

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

export interface DoctorLoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  token: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    staffRole?: StaffRole;
  };
  staff?: {
    id: string;
    employeeCode: string;
    role: StaffRole;
    status: StaffStatus;
  };
  doctor?: {
    id: string;
    name: string;
    email: string;
    specialization?: string;
    department?: string;
  };
  message?: string;
}
