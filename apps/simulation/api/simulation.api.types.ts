// Standalone Simulation API Types
// Strictly isolated to apps/web/src/simulation/api/

export type SystemUserRole = 'PATIENT' | 'USER' | 'STAFF' | 'ADMIN';

export type SimulationStaffRole =
  | 'DOCTOR'
  | 'NURSE'
  | 'PHARMACIST'
  | 'LAB_TECH'
  | 'RECEPTIONIST'
  | 'BILLING_CLERK'
  | 'OPD_MANAGER';

export type SimulationVisitStatus =
  | 'REGISTERED'
  | 'VITALS'
  | 'WAITING_OPD'
  | 'IN_CONSULTATION'
  | 'DIAGNOSTICS'
  | 'PHARMACY'
  | 'BILLING'
  | 'COMPLETED'
  | 'CANCELLED';

export type SimulationQueueStatus =
  | 'WAITING'
  | 'CALLED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED';

export type SimulationQueueType =
  | 'APPOINTMENT'
  | 'WALKIN'
  | 'DIAGNOSTICS'
  | 'PHARMACY'
  | 'BILLING';

export type SimulationWorkflowStatus =
  | 'WAITING'
  | 'BLOCKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type SimulationWorkflowType =
  | 'CONSULTATION'
  | 'LAB_TEST'
  | 'PHARMACY_DISPENSE'
  | 'BILLING'
  | 'VITALS';

export interface SimulatedUser {
  id: string;
  name: string;
  email: string;
  role: SystemUserRole;
  isActive?: boolean;
  staffProfile?: {
    id: string;
    employeeCode: string;
    staffRole: SimulationStaffRole;
    departmentId?: string | null;
    department?: string | null;
  };
}

export interface AuthLoginResponse {
  message?: string;
  token?: string;
  accessToken?: string;
  user?: SimulatedUser;
}

export interface AuthRegisterResponse {
  message?: string;
  token?: string;
  user?: SimulatedUser;
}

export interface SimulatedPatientProfile {
  id: string;
  userId?: string | null;
  user_id?: string | null;
  name: string;
  dateOfBirth?: string;
  date_of_birth?: string;
  gender: 'Male' | 'Female' | 'Other';
  phone?: string | null;
  address?: string | null;
  patientType?: 'Online' | 'Walkin';
  createdAt?: string;
  created_at?: string;
}

export interface SimulatedAppointment {
  id: string;
  patientId: string;
  patient_id?: string;
  doctorId: string;
  doctor_id?: string;
  startTime: string;
  start_time?: string;
  endTime: string;
  end_time?: string;
  type: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
}

export interface SimulatedVisit {
  id: string;
  patientId: string;
  patient_id?: string;
  patientName?: string;
  patient_name?: string;
  appointmentId?: string | null;
  appointment_id?: string | null;
  visitType: string;
  visit_type?: string;
  status: SimulationVisitStatus;
  departmentId?: string | null;
  department_id?: string | null;
  assignedDoctorId?: string | null;
  assigned_doctor_id?: string | null;
  registeredBy?: string | null;
  registered_by?: string | null;
  checkedInAt?: string;
  checked_in_at?: string;
  completedAt?: string | null;
  completed_at?: string | null;
  createdAt: string;
  created_at?: string;
}

export interface SimulatedQueueEntry {
  id: string;
  visitId: string;
  visit_id?: string;
  departmentId?: string | null;
  department_id?: string | null;
  doctorId?: string | null;
  doctor_id?: string | null;
  queueType: SimulationQueueType;
  queue_type?: SimulationQueueType;
  priority: number;
  status: SimulationQueueStatus;
  tokenNumber?: number | null;
  token_number?: number | null;
  joinedAt: string;
  joined_at?: string;
  calledAt?: string | null;
  called_at?: string | null;
  startedAt?: string | null;
  started_at?: string | null;
  completedAt?: string | null;
  completed_at?: string | null;
}

export interface SimulatedConsultation {
  id: string;
  visitId: string;
  visit_id?: string;
  doctorId: string;
  doctor_id?: string;
  appointmentId?: string | null;
  appointment_id?: string | null;
  diagnosis: string;
  notes?: string | null;
  treatmentPlan?: string | null;
  treatment_plan?: string | null;
}

export interface SimulatedLabOrder {
  id: string;
  visitId: string;
  visit_id?: string;
  doctorId: string;
  doctor_id?: string;
  testName: string;
  test_name?: string;
  instructions?: string | null;
  status: 'PENDING' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  result?: string | null;
  createdAt: string;
  created_at?: string;
}

export interface SimulatedPrescription {
  id: string;
  visitId: string;
  visit_id?: string;
  doctorId: string;
  doctor_id?: string;
  medication: string;
  dosage: string;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
  status: 'PENDING' | 'PARTIALLY_DISPENSED' | 'DISPENSED' | 'CANCELLED';
}

export interface SimulatedInvoice {
  id: string;
  visitId: string;
  visit_id?: string;
  patientId: string;
  patient_id?: string;
  totalAmount: number | string;
  total_amount?: number | string;
  amount?: number | string;
  status: 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  createdAt: string;
  created_at?: string;
  paidAt?: string | null;
  paid_at?: string | null;
}

export interface SimulatedWorkflowTask {
  id: string;
  visitId: string;
  visit_id: string;
  taskType: SimulationWorkflowType;
  task_type: SimulationWorkflowType;
  status: SimulationWorkflowStatus;
  priority: number;
  departmentId: string | null;
  assignedDoctorId: string | null;
  dependsOnTaskIds: string[];
  blockedByTaskIds: string[];
  isReady: boolean;
  createdAt: string;
  completedAt: string | null;
}

// Secure Request Log Model (All sensitive data strictly redacted)
export interface SimulationHttpRequestLog {
  id: string;
  runId: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  url: string;
  endpoint: string;
  status: number;
  durationMs: number;
  workflowEvent?: string;
  correlationId?: string;
  error?: string;
  redactedSummary?: string;
}
