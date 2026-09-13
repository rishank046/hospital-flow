export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export type AccountType = 'patient' | 'doctor';
export type AuthMode = 'login' | 'register';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
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
