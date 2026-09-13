import { request } from './api.client';
import type {
  Appointment,
  BookAppointmentPayload,
  Consultation,
  PatientJourneyResponse,
  PatientProfile,
  Prescription,
  Report,
} from '../types/patient.types';

export const patientService = {
  getProfile: async () => {
    const data = await request<PatientProfile>('/patients/me');
    return {
      ...data,
      patientType: data.patientType || data.patient_type || 'Online',
      doctorId: data.doctorId || data.doctor_id,
      createdAt: data.createdAt || data.created_at,
    };
  },

  updateProfile: (data: Partial<PatientProfile>) => {
    const payload: Record<string, unknown> = {};
    if (data.name) payload.name = data.name;
    if (typeof data.age === 'number' && data.age > 0) payload.age = data.age;
    if (data.gender) payload.gender = data.gender;
    if (data.patientType || data.patient_type) {
      payload.patientType = data.patientType || data.patient_type;
    }
    if (data.doctorId) payload.doctorId = data.doctorId;

    return request<PatientProfile>('/patients/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getAppointments: async () => {
    const data = await request<{ appointments?: Appointment[] } | Appointment[]>(
      '/patients/me/appointments'
    );
    const rawList = (Array.isArray(data) ? data : data.appointments || []) as Array<
      Appointment & Record<string, unknown>
    >;
    return rawList.map((a) => {
      const startTime = (a.startTime || a.start_time || '') as string;
      const endTime = (a.endTime || a.end_time || '') as string;
      const isPast = endTime ? new Date(endTime).getTime() < Date.now() : false;
      return {
        ...a,
        doctorId: (a.doctorId || a.doctor_id) as string | undefined,
        doctorName: (a.doctorName || a.doctor_name) as string | undefined,
        doctorSpecialization: (a.doctorSpecialization || a.doctor_specialization) as string | undefined,
        doctorDepartment: (a.doctorDepartment || a.doctor_department) as string | undefined,
        startTime,
        endTime,
        status: a.status || (isPast ? 'COMPLETED' : 'SCHEDULED'),
        createdAt: (a.createdAt || a.created_at) as string | undefined,
      } as Appointment;
    });
  },

  bookAppointment: (payload: BookAppointmentPayload) =>
    request<Appointment>('/patients/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelAppointment: (appointmentId: string) =>
    request<{ message: string }>(`/patients/appointments/${appointmentId}`, {
      method: 'DELETE',
    }),

  getJourney: async () => {
    const data = await request<PatientJourneyResponse | { journey?: unknown[] }>(
      '/patients/me/journey'
    );
    return data;
  },

  getConsultations: async () => {
    const data = await request<{ consultations?: Consultation[] } | Consultation[]>(
      '/patients/me/consultations'
    );
    const rawList = (Array.isArray(data) ? data : data.consultations || []) as Array<
      Consultation & Record<string, unknown>
    >;
    return rawList.map((c) => ({
      ...c,
      doctorName: (c.doctorName || c.doctor_name) as string | undefined,
      doctorSpecialization: (c.doctorSpecialization || c.doctor_specialization) as string | undefined,
      doctorDepartment: (c.doctorDepartment || c.doctor_department) as string | undefined,
      treatmentPlan: (c.treatmentPlan || c.treatment_plan) as string | undefined,
      createdAt: (c.createdAt || c.created_at) as string | undefined,
      updatedAt: (c.updatedAt || c.updated_at) as string | undefined,
    } as Consultation));
  },

  getReports: async () => {
    const data = await request<{ reports?: Report[] } | Report[]>(
      '/patients/me/reports'
    );
    const rawList = (Array.isArray(data) ? data : data.reports || []) as Array<
      Report & Record<string, unknown>
    >;
    return rawList.map((r) => ({
      ...r,
      testName: (r.testName || r.test_name) as string,
      doctorName: (r.doctorName || r.doctor_name) as string | undefined,
      createdAt: (r.createdAt || r.created_at) as string | undefined,
      updatedAt: (r.updatedAt || r.updated_at) as string | undefined,
    } as Report));
  },

  getPrescriptions: async () => {
    const data = await request<{ prescriptions?: Prescription[] } | Prescription[]>(
      '/patients/me/prescriptions'
    );
    const rawList = (Array.isArray(data) ? data : data.prescriptions || []) as Array<
      Prescription & Record<string, unknown>
    >;
    return rawList.map((p) => ({
      ...p,
      doctorName: (p.doctorName || p.doctor_name) as string | undefined,
      consultationId: (p.consultationId || p.consultation_id) as string | undefined,
      createdAt: (p.createdAt || p.created_at) as string | undefined,
    } as Prescription));
  },
};
