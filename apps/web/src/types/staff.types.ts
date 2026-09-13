import type { StaffRole, StaffStatus } from './auth.types';

export interface StaffProfile {
  staff_id: string;
  user_id: string;
  employee_code: string;
  staff_role: StaffRole;
  staff_status: StaffStatus;
  created_at: string;
  name: string;
  email: string;
  system_role: string;
  doctor_id?: string;
  specialization?: string;
  license_number?: string;
  department?: string;
}
