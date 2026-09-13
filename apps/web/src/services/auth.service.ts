import { request } from './api.client';
import type {
  AuthTokenResponse,
  DoctorLoginCredentials,
  LoginCredentials,
  RegisterPayload,
} from '../types/auth.types';

export const authService = {
  login: (credentials: LoginCredentials) =>
    request<AuthTokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (payload: RegisterPayload) =>
    request<AuthTokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  doctorLogin: (credentials: DoctorLoginCredentials) =>
    request<AuthTokenResponse>('/doctors/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  staffLogin: (credentials: LoginCredentials) =>
    request<AuthTokenResponse>('/staff/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),
};
