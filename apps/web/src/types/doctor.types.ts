import type { Consultation } from './patient.types';

export interface DoctorProfile {
  id: string;
  name: string;
  email: string;
  specialization: string;
  department: string;
  createdAt?: string;
  created_at?: string;
}

export interface ScheduleItem {
  id: string;
  patientId: string;
  patient_id?: string;
  patientName?: string;
  patient_name?: string;
  startTime: string;
  start_time?: string;
  endTime: string;
  end_time?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
}

export interface DoctorPatientItem {
  id: string;
  name: string;
  email?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  patientType?: 'Online' | 'Walkin';
  patient_type?: 'Online' | 'Walkin';
  lastVisit?: string;
  created_at?: string;
}

export interface PrescriptionInput {
  medication: string;
  dosage: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface CreateConsultationPayload {
  appointmentId?: string;
  diagnosis: string;
  notes?: string;
  treatmentPlan?: string;
  prescriptions?: PrescriptionInput[];
}

export interface UpdateConsultationPayload {
  diagnosis?: string;
  notes?: string;
  treatmentPlan?: string;
}

export interface CreateInvestigationOrderPayload {
  testName: string;
  instructions?: string;
}

export interface InvestigationOrder {
  id: string;
  patientId: string;
  patient_id?: string;
  doctorId: string;
  doctor_id?: string;
  testName: string;
  test_name?: string;
  instructions?: string;
  status: 'PENDING' | 'COMPLETED';
  result?: string;
  createdAt?: string;
  created_at?: string;
}

export interface DoctorPatientDetail {
  patient: DoctorPatientItem;
  consultations: Consultation[];
  orders: InvestigationOrder[];
}

