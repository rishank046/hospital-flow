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
  getProfile: () => request<PatientProfile>('/patients/me'),

  updateProfile: (data: Partial<PatientProfile>) =>
    request<PatientProfile>('/patients/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAppointments: async () => {
    const data = await request<{ appointments?: Appointment[] } | Appointment[]>(
      '/patients/me/appointments'
    );
    if (Array.isArray(data)) {
      return data;
    }
    return data.appointments || [];
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
    if (Array.isArray(data)) {
      return data;
    }
    return data.consultations || [];
  },

  getReports: async () => {
    const data = await request<{ reports?: Report[] } | Report[]>(
      '/patients/me/reports'
    );
    if (Array.isArray(data)) {
      return data;
    }
    return data.reports || [];
  },

  getPrescriptions: async () => {
    const data = await request<{ prescriptions?: Prescription[] } | Prescription[]>(
      '/patients/me/prescriptions'
    );
    if (Array.isArray(data)) {
      return data;
    }
    return data.prescriptions || [];
  },
};
