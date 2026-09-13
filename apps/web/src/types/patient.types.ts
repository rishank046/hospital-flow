export type PatientType = 'Online' | 'Walkin';
export type Gender = 'Male' | 'Female' | 'Other';

export interface PatientProfile {
  id: string;
  owner_user_id?: string;
  name: string;
  email?: string;
  age: number;
  gender: Gender;
  patientType?: PatientType;
  patient_type?: PatientType;
  doctorId?: string | null;
  doctor_id?: string | null;
  createdAt?: string;
  created_at?: string;
}

export interface Appointment {
  id: string;
  patientId?: string;
  patient_id?: string;
  doctorId?: string;
  doctor_id?: string;
  doctorName?: string;
  doctor_name?: string;
  doctorSpecialization?: string;
  doctor_specialization?: string;
  doctorDepartment?: string;
  doctor_department?: string;
  startTime: string;
  start_time?: string;
  endTime: string;
  end_time?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  createdAt?: string;
  created_at?: string;
}

export interface BookAppointmentPayload {
  doctorId: string;
  startTime: string;
  endTime: string;
}

export interface JourneyEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  status?: string;
}

export interface PatientJourneyResponse {
  events: JourneyEvent[];
}

export interface Prescription {
  id: string;
  consultationId?: string;
  consultation_id?: string;
  patientId: string;
  patient_id?: string;
  doctorId: string;
  doctor_id?: string;
  doctorName?: string;
  medication: string;
  dosage: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  createdAt?: string;
  created_at?: string;
}

export interface Report {
  id: string;
  patientId: string;
  patient_id?: string;
  doctorId: string;
  doctor_id?: string;
  doctorName?: string;
  testName: string;
  test_name?: string;
  instructions?: string;
  status: 'PENDING' | 'COMPLETED';
  result?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface Consultation {
  id: string;
  doctorId?: string;
  doctor_id?: string;
  doctorName?: string;
  patientId?: string;
  patient_id?: string;
  appointmentId?: string;
  appointment_id?: string;
  diagnosis: string;
  notes?: string;
  treatmentPlan?: string;
  treatment_plan?: string;
  createdAt?: string;
  created_at?: string;
  prescriptions?: Prescription[];
}

