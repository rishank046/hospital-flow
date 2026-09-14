import { request } from './api.client';
import type {
  CreateVisitPayload,
  DispensePayload,
  DoctorSummary,
  LabOrderItem,
  PatientSummary,
  PrescriptionItem,
  StaffProfile,
  UpdateLabOrderPayload,
  VisitItem,
  VisitStatus,
  VitalsRecordPayload,
} from '../types/staff.types';

export const staffService = {
  getProfile: () => request<StaffProfile>('/staff/me'),
  getStaffById: (staffId: string) => request<StaffProfile>(`/staff/${staffId}`),
  listStaff: () => request<{ staff: StaffProfile[] }>('/staff'),

  getVisits: async (status?: string): Promise<VisitItem[]> => {
    const url = status ? `/visits?status=${encodeURIComponent(status)}` : '/visits';
    const res = await request<{ visits?: VisitItem[] } | VisitItem[]>(url);
    if (Array.isArray(res)) {
      return res;
    }
    return res.visits || [];
  },

  getVisitById: (visitId: string) => request<VisitItem>(`/visits/${visitId}`),

  createVisit: (payload: CreateVisitPayload): Promise<VisitItem> =>
    request<VisitItem>('/visits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateVisitStatus: (visitId: string, status: VisitStatus): Promise<VisitItem> =>
    request<VisitItem>(`/visits/${visitId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  recordVitals: (visitId: string, payload: VitalsRecordPayload) =>
    request<unknown>(`/visits/${visitId}/vitals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPrescriptions: async (status = 'PENDING'): Promise<PrescriptionItem[]> => {
    const url = status ? `/prescriptions?status=${encodeURIComponent(status)}` : '/prescriptions';
    const res = await request<{ prescriptions?: PrescriptionItem[] } | PrescriptionItem[]>(url);
    if (Array.isArray(res)) {
      return res;
    }
    return res.prescriptions || [];
  },

  dispensePrescription: (prescriptionId: string, payload: DispensePayload = { quantity: 1 }) =>
    request<unknown>(`/prescriptions/${prescriptionId}/dispense`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getLabOrders: async (status?: string): Promise<LabOrderItem[]> => {
    const url = status ? `/lab-orders?status=${encodeURIComponent(status)}` : '/lab-orders';
    const res = await request<{ orders?: LabOrderItem[] } | LabOrderItem[]>(url);
    if (Array.isArray(res)) {
      return res;
    }
    return res.orders || [];
  },

  updateLabOrder: (orderId: string, payload: UpdateLabOrderPayload) =>
    request<LabOrderItem>(`/lab-orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getPatients: async (): Promise<PatientSummary[]> => {
    const res = await request<{ patients?: PatientSummary[] } | PatientSummary[]>('/patients');
    if (Array.isArray(res)) {
      return res;
    }
    return res.patients || [];
  },

  createPatient: (payload: { name: string; age: number; gender: string; patientType?: string }): Promise<PatientSummary> =>
    request<PatientSummary>('/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getDoctors: async (): Promise<DoctorSummary[]> => {
    const res = await request<{ doctors?: DoctorSummary[] } | DoctorSummary[]>('/doctors');
    if (Array.isArray(res)) {
      return res;
    }
    return res.doctors || [];
  },
};
