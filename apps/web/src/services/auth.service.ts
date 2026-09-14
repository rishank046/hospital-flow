import { request } from './api.client';
import type {
  AuthTokenResponse,
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

  me: () =>
    request<AuthTokenResponse>('/auth/me', {
      method: 'GET',
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),
};
