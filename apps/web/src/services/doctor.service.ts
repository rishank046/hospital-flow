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
    const rawList = (Array.isArray(data) ? data : data.schedule || []) as Array<
      ScheduleItem & Record<string, unknown>
    >;
    return rawList.map((s) => {
      const startTime = (s.startTime || s.start_time || '') as string;
      const endTime = (s.endTime || s.end_time || '') as string;
      const isPast = endTime ? new Date(endTime).getTime() < Date.now() : false;
      return {
        ...s,
        patientId: (s.patientId || s.patient_id) as string,
        patientName: (s.patientName || s.patient_name) as string | undefined,
        startTime,
        endTime,
        status: s.status || (isPast ? 'COMPLETED' : 'SCHEDULED'),
      } as ScheduleItem;
    });
  },

  getPatients: async () => {
    const data = await request<{ patients?: DoctorPatientItem[] } | DoctorPatientItem[]>(
      '/doctors/me/patients'
    );
    const rawList = (Array.isArray(data) ? data : data.patients || []) as Array<
      DoctorPatientItem & Record<string, unknown>
    >;
    return rawList.map((p) => ({
      ...p,
      patientType: (p.patientType || p.patient_type || 'Online') as 'Online' | 'Walkin',
      email: (p.email || p.owner_email) as string | undefined,
    } as DoctorPatientItem));
  },

  getPatientDetail: async (patientId: string) => {
    const detail = await request<DoctorPatientDetail & { patient: Record<string, unknown> }>(
      `/doctors/patients/${patientId}`
    );
    return {
      ...detail,
      patient: {
        ...detail.patient,
        patientType: (detail.patient.patientType || detail.patient.patient_type || 'Online') as 'Online' | 'Walkin',
        email: (detail.patient.email || detail.patient.owner_email) as string | undefined,
      } as DoctorPatientItem,
    };
  },

  createConsultation: (
    patientId: string,
    payload: CreateConsultationPayload
  ) => {
    const cleanPayload: Record<string, unknown> = {
      diagnosis: payload.diagnosis,
    };
    if (payload.appointmentId && payload.appointmentId.trim()) {
      cleanPayload.appointmentId = payload.appointmentId.trim();
    }
    if (payload.notes?.trim()) cleanPayload.notes = payload.notes.trim();
    if (payload.treatmentPlan?.trim()) cleanPayload.treatmentPlan = payload.treatmentPlan.trim();
    if (payload.prescriptions && payload.prescriptions.length > 0) {
      cleanPayload.prescriptions = payload.prescriptions;
    }

    return request<Consultation>(`/doctors/patients/${patientId}/consultation`, {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
  },

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
      body: JSON.stringify({
        testName: payload.testName.trim(),
        instructions: payload.instructions?.trim() || undefined,
      }),
    }),

  getPatientReports: async (patientId: string) => {
    const data = await request<
      { reports?: InvestigationOrder[] } | InvestigationOrder[]
    >(`/doctors/patients/${patientId}/reports`);
    const rawList = (Array.isArray(data) ? data : data.reports || []) as Array<
      InvestigationOrder & Record<string, unknown>
    >;
    return rawList.map((r) => ({
      ...r,
      testName: (r.testName || r.test_name) as string,
      createdAt: (r.createdAt || r.created_at) as string | undefined,
      updatedAt: (r.updatedAt || r.updated_at) as string | undefined,
    } as InvestigationOrder));
  },
};
