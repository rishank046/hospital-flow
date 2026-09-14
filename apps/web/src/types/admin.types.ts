import type { StaffRole, StaffStatus } from './auth.types';

export interface AdminStaffMember {
  id: string;
  staff_id?: string;
  user_id: string;
  employee_code: string;
  role: StaffRole;
  staff_role?: StaffRole;
  status: StaffStatus;
  staff_status?: StaffStatus;
  department_id?: string | null;
  department?: string | null;
  name: string;
  email: string;
  is_active: boolean;
  doctor_id?: string | null;
  specialization?: string | null;
  created_at: string;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  role: StaffRole;
  status?: StaffStatus;
  employeeCode?: string;
  department?: string;
  departmentId?: string;
  specialization?: string;
  licenseNumber?: string;
  password?: string;
}

export interface CreateStaffResponse {
  staff: {
    id: string;
    userId: string;
    employeeCode: string;
    role: StaffRole;
    status: StaffStatus;
    departmentId?: string | null;
    createdAt: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  temporaryPassword: string;
  doctor?: {
    id: string;
    specialization?: string;
    department?: string;
    license_number?: string;
  };
}

export interface UpdateStaffPayload {
  name?: string;
  email?: string;
  employeeCode?: string;
  role?: StaffRole;
  status?: StaffStatus;
  department?: string;
  departmentId?: string;
}

export interface AdminDoctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  department: string;
  created_at: string;
}

export interface CreateDoctorPayload {
  name: string;
  email: string;
  password: string;
  specialization: string;
  department: string;
}

export interface AdminPatient {
  id: string;
  owner_user_id?: string;
  name: string;
  age: number;
  gender: string;
  patient_type: string;
  doctor_id?: string | null;
  owner_email?: string | null;
  created_at: string;
}

export interface AdminDashboardStats {
  totalStaff: number;
  activeStaff: number;
  staffByRole: Record<string, number>;
  totalDoctors: number;
  totalPatients: number;
  activeVisitsToday: number;
  pendingInvoicesCount: number;
  pendingInvoicesAmount: number;
}
