import { request } from './api.client';
import type {
  CreateConsultationPayload,
  CreateInvestigationOrderPayload,
  DoctorPatientDetail,
  DoctorPatientItem,
  DoctorProfile,
  InvestigationOrder,
  ScheduleItem,
  UpdateConsultationPayload,
} from '../types/doctor.types';
import type { Consultation } from '../types/patient.types';

export const doctorService = {
  getProfile: () => request<DoctorProfile>('/doctors/me'),

  updateProfile: (data: Partial<DoctorProfile>) =>
    request<DoctorProfile>('/doctors/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getSchedule: async () => {
    const data = await request<{ schedule?: ScheduleItem[] } | ScheduleItem[]>(
      '/doctors/me/schedule'
    );
    if (Array.isArray(data)) {
      return data;
    }
    return data.schedule || [];
  },

  getPatients: async () => {
    const data = await request<{ patients?: DoctorPatientItem[] } | DoctorPatientItem[]>(
      '/doctors/me/patients'
    );
    if (Array.isArray(data)) {
      return data;
    }
    return data.patients || [];
  },

  getPatientDetail: (patientId: string) =>
    request<DoctorPatientDetail>(`/doctors/patients/${patientId}`),

  createConsultation: (
    patientId: string,
    payload: CreateConsultationPayload
  ) =>
    request<Consultation>(`/doctors/patients/${patientId}/consultation`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateConsultation: (
    consultationId: string,
    payload: UpdateConsultationPayload
  ) =>
    request<Consultation>(`/doctors/consultations/${consultationId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  orderLabTest: (
    patientId: string,
    payload: CreateInvestigationOrderPayload
  ) =>
    request<InvestigationOrder>(`/doctors/patients/${patientId}/orders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPatientReports: async (patientId: string) => {
    const data = await request<
      { reports?: InvestigationOrder[] } | InvestigationOrder[]
    >(`/doctors/patients/${patientId}/reports`);
    if (Array.isArray(data)) {
      return data;
    }
    return data.reports || [];
  },
};
