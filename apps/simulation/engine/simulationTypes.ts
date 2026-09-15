// Simulation State, Actor & Metric Types
// Strictly isolated to apps/web/src/simulation/engine/

import type { SimulationHttpRequestLog, SimulationVisitStatus } from '../api/simulation.api.types';

export type SimulationStatus = 'IDLE' | 'BOOTSTRAPPING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';

export type SimulationDisplayMode = 'MAP' | 'GUI' | 'LOG';

export type DepartmentType =
  | 'RECEPTION'
  | 'VITALS'
  | 'DOCTOR_OPD'
  | 'LAB'
  | 'PHARMACY'
  | 'BILLING'
  | 'DISCHARGED';

export interface SimulatedActor {
  id: string;
  role:
    | 'ONLINE_USER'
    | 'DOCTOR'
    | 'OPD_MANAGER'
    | 'LAB_TECH'
    | 'PHARMACIST'
    | 'BILLING_CLERK'
    | 'NURSE'
    | 'ADMIN';
  name: string;
  email: string;
  token: string | null;
  status: 'INITIALIZING' | 'READY' | 'BUSY' | 'OFFLINE';
  activePatientId?: string;
  specialization?: string;
  department?: string;
  backendDoctorId?: string;
  tasksCompleted: number;
  requestsCount: number;
}

export interface PatientJourneyStep {
  time: string;
  stage: DepartmentType;
  title: string;
  description: string;
  isBlocker?: boolean;
}

export interface SimulatedPatientJourney {
  patientId: string;
  patientName: string;
  patientType: 'Online' | 'Walkin';
  visitId?: string;
  currentDepartment: DepartmentType;
  visitStatus: SimulationVisitStatus;
  doctorName?: string;
  hasLabTest: boolean;
  labStatus?: string;
  hasPrescription: boolean;
  pharmacyStatus?: string;
  billingStatus?: string;
  isBlocked: boolean;
  blockReason?: string;
  timeline: PatientJourneyStep[];
  startedAt: string;
  completedAt?: string;
  totalDurationSec?: number;
}

export interface DepartmentMetrics {
  id: DepartmentType;
  name: string;
  patientsPresent: number;
  queueSize: number;
  activeStaff: number;
  averageWaitSec: number;
  processedCount: number;
  isBottleneck: boolean;
}

export interface OverallSimulationMetrics {
  runId: string;
  elapsedSec: number;
  totalPatients: number;
  completedJourneys: number;
  inProgressVisits: number;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgCycleTimeSec: number;
  bottleneckDepartment: string | null;
  activeActorsCount: number;
}

export interface SimulationDomainEvent {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  actorName: string;
  actorRole: string;
  patientName?: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export interface SimulationState {
  runId: string;
  status: SimulationStatus;
  speed: number;
  elapsedSec: number;
  currentScenarioId: string;
  actors: SimulatedActor[];
  patients: SimulatedPatientJourney[];
  departments: Record<DepartmentType, DepartmentMetrics>;
  metrics: OverallSimulationMetrics;
  recentEvents: SimulationDomainEvent[];
  requestLogs: SimulationHttpRequestLog[];
  errorMessage?: string | null;
}
