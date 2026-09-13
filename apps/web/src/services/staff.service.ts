import { request } from './api.client';
import type { StaffProfile } from '../types/staff.types';

export const staffService = {
  getProfile: () => request<StaffProfile>('/staff/me'),
  getStaffById: (staffId: string) => request<StaffProfile>(`/staff/${staffId}`),
  listStaff: () => request<{ staff: StaffProfile[] }>('/staff'),
};
