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

export type VisitStatus =
  | 'REGISTERED'
  | 'VITALS'
  | 'WAITING_OPD'
  | 'IN_CONSULTATION'
  | 'DIAGNOSTICS'
  | 'PHARMACY'
  | 'BILLING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface VisitItem {
  id: string;
  patient_id: string;
  patientId?: string;
  patient_name?: string | null;
  visit_type: string;
  visitType?: string;
  department_id?: string | null;
  department_name?: string | null;
  appointment_id?: string | null;
  assigned_doctor_id?: string | null;
  doctor_name?: string | null;
  registered_by?: string | null;
  status: VisitStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateVisitPayload {
  patientId: string;
  visitType: string;
  departmentId?: string | null;
  assignedDoctorId?: string | null;
  appointmentId?: string | null;
}

export interface VitalsRecordPayload {
  temperature?: number | null;
  heartRate?: number | null;
  bloodPressure?: string | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weight?: number | null;
  height?: number | null;
  notes?: string | null;
}

export interface PrescriptionItem {
  id: string;
  consultation_id?: string | null;
  visit_id?: string | null;
  patient_id: string;
  patient_name?: string | null;
  doctor_id: string;
  doctor_name?: string | null;
  medication: string;
  dosage: string;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
  status: 'PENDING' | 'DISPENSED' | 'PARTIALLY_DISPENSED' | 'CANCELLED';
  created_at: string;
}

export interface DispensePayload {
  quantity?: number;
  notes?: string | null;
}

export interface LabOrderItem {
  id: string;
  patient_id: string;
  patient_name?: string | null;
  doctor_id: string;
  doctor_name?: string | null;
  visit_id?: string | null;
  test_name: string;
  instructions?: string | null;
  status: 'PENDING' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  result?: string | null;
  performed_by?: string | null;
  performed_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateLabOrderPayload {
  status?: 'PENDING' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  result?: string | null;
  instructions?: string | null;
}

export interface PatientSummary {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  patient_type?: string;
  created_at?: string;
}

export interface DoctorSummary {
  id: string;
  name: string;
  specialization?: string;
  department?: string;
}
