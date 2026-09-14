import { request } from './api.client';
import type {
  AdminDashboardStats,
  AdminDoctor,
  AdminPatient,
  AdminStaffMember,
  CreateDoctorPayload,
  CreateStaffPayload,
  CreateStaffResponse,
  UpdateStaffPayload,
} from '../types/admin.types';
import type { StaffStatus } from '../types/auth.types';

export const adminService = {
  getStaff: async (): Promise<AdminStaffMember[]> => {
    const res = await request<{ staff: AdminStaffMember[] }>('/admin/staff');
    return res.staff || [];
  },

  createStaff: (payload: CreateStaffPayload): Promise<CreateStaffResponse> =>
    request<CreateStaffResponse>('/admin/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateStaff: (staffId: string, payload: UpdateStaffPayload): Promise<AdminStaffMember> =>
    request<AdminStaffMember>(`/admin/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateStaffStatus: (staffId: string, status: StaffStatus): Promise<AdminStaffMember> =>
    request<AdminStaffMember>(`/admin/staff/${staffId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getDoctors: async (): Promise<AdminDoctor[]> => {
    const res = await request<{ doctors: AdminDoctor[] }>('/admin/doctors');
    return res.doctors || [];
  },

  createDoctor: (payload: CreateDoctorPayload): Promise<AdminDoctor> =>
    request<AdminDoctor>('/admin/doctors', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPatients: async (): Promise<AdminPatient[]> => {
    const res = await request<{ patients: AdminPatient[] }>('/admin/patients');
    return res.patients || [];
  },

  getDashboardStats: async (): Promise<AdminDashboardStats> => {
    const [staffRes, doctorsRes, patientsRes, queueRes, invoicesRes] = await Promise.allSettled([
      request<{ staff: AdminStaffMember[] }>('/admin/staff'),
      request<{ doctors: AdminDoctor[] }>('/admin/doctors'),
      request<{ patients: AdminPatient[] }>('/admin/patients'),
      request<{ queue?: Array<{ status: string }>; waitingCount?: number }>('/queue'),
      request<{ invoices?: Array<{ status: string; amount?: string | number }> }>('/invoices?status=PENDING'),
    ]);

    const staffList: AdminStaffMember[] =
      staffRes.status === 'fulfilled' ? staffRes.value.staff || [] : [];
    const doctorsList: AdminDoctor[] =
      doctorsRes.status === 'fulfilled' ? doctorsRes.value.doctors || [] : [];
    const patientsList: AdminPatient[] =
      patientsRes.status === 'fulfilled' ? patientsRes.value.patients || [] : [];

    const activeStaff = staffList.filter(
      (s) => s.status === 'ACTIVE' || s.staff_status === 'ACTIVE' || s.is_active
    ).length;

    const staffByRole: Record<string, number> = {};
    for (const member of staffList) {
      const roleName = member.staff_role || member.role || 'STAFF';
      staffByRole[roleName] = (staffByRole[roleName] || 0) + 1;
    }

    let activeVisitsToday = 0;
    if (queueRes.status === 'fulfilled') {
      const q = queueRes.value.queue || [];
      const activeQueue = q.filter(
        (entry) => entry.status === 'WAITING' || entry.status === 'CALLED' || entry.status === 'IN_PROGRESS' || entry.status === 'SERVING'
      );
      activeVisitsToday = activeQueue.length || queueRes.value.waitingCount || 0;
    }

    let pendingInvoicesCount = 0;
    let pendingInvoicesAmount = 0;
    if (invoicesRes.status === 'fulfilled') {
      const invoices = invoicesRes.value.invoices || [];
      const pendingList = invoices.filter((inv) => inv.status === 'PENDING');
      pendingInvoicesCount = pendingList.length;
      pendingInvoicesAmount = pendingList.reduce(
        (acc, inv) => acc + (Number(inv.amount) || 0),
        0
      );
    }

    return {
      totalStaff: staffList.length,
      activeStaff,
      staffByRole,
      totalDoctors: doctorsList.length,
      totalPatients: patientsList.length,
      activeVisitsToday,
      pendingInvoicesCount,
      pendingInvoicesAmount,
    };
  },
};
