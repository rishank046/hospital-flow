// Standalone Simulation API Service
// Strictly isolated to apps/web/src/simulation/api/
import { simulationHttp, type RequestActorContext } from './simulation.http';
import type {
  AuthLoginResponse,
  AuthRegisterResponse,
  SimulatedAppointment,
  SimulatedConsultation,
  SimulatedInvoice,
  SimulatedLabOrder,
  SimulatedPatientProfile,
  SimulatedPrescription,
  SimulatedQueueEntry,
  SimulatedUser,
  SimulatedVisit,
  SimulatedWorkflowTask,
  SimulationVisitStatus,
} from './simulation.api.types';

export class SimulationApiService {
  // -------------------------------------------------------------
  // 1. Authentication & Registration Endpoints
  // -------------------------------------------------------------

  /**
   * Register a simulated online user/patient using the real registration endpoint.
   */
  public async registerUser(
    name: string,
    email: string,
    password: string,
    runId?: string
  ): Promise<AuthRegisterResponse> {
    const res = await simulationHttp.request<
      AuthRegisterResponse & { data?: { token?: string; user?: SimulatedUser } }
    >('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      runId,
      workflowEvent: 'USER_REGISTERED',
      actor: {
        actorId: 'ANONYMOUS_USER',
        actorRole: 'ANONYMOUS',
        actorName: name,
      },
    });

    return {
      token: res.token || res.data?.token,
      user: res.user || res.data?.user,
      message: res.message,
    };
  }

  /**
   * Authenticate a simulated actor to obtain a real runtime JWT.
   */
  public async login(
    email: string,
    password: string,
    actorMeta?: { actorId: string; actorRole: string; actorName: string },
    runId?: string
  ): Promise<AuthLoginResponse> {
    const res = await simulationHttp.request<
      AuthLoginResponse & { data?: { token?: string; user?: SimulatedUser } }
    >('/auth/login', {
      method: 'POST',
      body: { email, password },
      runId,
      workflowEvent: 'ACTOR_AUTHENTICATED',
      actor: {
        actorId: actorMeta?.actorId || 'UNKNOWN',
        actorRole: actorMeta?.actorRole || 'UNKNOWN',
        actorName: actorMeta?.actorName || email,
      },
    });

    return {
      token: res.token || res.accessToken || res.data?.token,
      accessToken: res.accessToken || res.token || res.data?.token,
      user: res.user || res.data?.user,
      message: res.message,
    };
  }

  /**
   * Get current authenticated user profile.
   */
  public async getMe(actor: RequestActorContext, runId?: string): Promise<{ user: SimulatedUser }> {
    return simulationHttp.request<{ user: SimulatedUser }>('/auth/me', {
      method: 'GET',
      actor,
      runId,
      workflowEvent: 'VERIFY_IDENTITY',
    });
  }

  // -------------------------------------------------------------
  // 2. Real Admin Staff & Doctor Provisioning Endpoints
  // -------------------------------------------------------------

  /**
   * Provision a doctor account through the real POST /admin/doctors endpoint.
   */
  public async adminCreateDoctor(
    payload: {
      name: string;
      email: string;
      password: string;
      specialization: string;
      department: string;
    },
    adminActor: RequestActorContext,
    runId?: string
  ): Promise<{ id: string; name: string; email: string }> {
    return simulationHttp.request('/admin/doctors', {
      method: 'POST',
      body: payload,
      actor: adminActor,
      runId,
      workflowEvent: 'PROVISION_DOCTOR',
    });
  }

  /**
   * Provision a staff account through the real POST /admin/staff endpoint.
   */
  public async adminCreateStaff(
    payload: {
      name: string;
      email: string;
      password: string;
      role: string;
      department?: string;
      specialization?: string;
    },
    adminActor: RequestActorContext,
    runId?: string
  ): Promise<{ id: string; name: string; email: string }> {
    return simulationHttp.request('/admin/staff', {
      method: 'POST',
      body: payload,
      actor: adminActor,
      runId,
      workflowEvent: 'PROVISION_STAFF',
    });
  }

  /**
   * Fetch available doctors in the hospital.
   */
  public async getDoctors(
    actor?: RequestActorContext,
    runId?: string
  ): Promise<Array<{ id: string; name: string; specialization: string; department?: string }>> {
    const res = await simulationHttp.request<
      | Array<{ id: string; name: string; specialization: string; department?: string }>
      | { doctors: Array<{ id: string; name: string; specialization: string; department?: string }> }
    >('/doctors', {
      method: 'GET',
      actor,
      runId,
      workflowEvent: 'QUERY_DOCTORS',
    });

    if (Array.isArray(res)) return res;
    return res.doctors || [];
  }

  // -------------------------------------------------------------
  // 3. Patient Profiles
  // -------------------------------------------------------------

  /**
   * Create a patient profile (online or walk-in) via real POST /patients.
   */
  public async createPatient(
    payload: {
      name: string;
      age?: number;
      dateOfBirth?: string;
      gender: 'Male' | 'Female' | 'Other';
      phone?: string;
      patientType?: 'Online' | 'Walkin';
    },
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedPatientProfile> {
    const res = await simulationHttp.request<
      SimulatedPatientProfile | { patient: SimulatedPatientProfile }
    >('/patients', {
      method: 'POST',
      body: payload,
      actor,
      runId,
      workflowEvent: 'CREATE_PATIENT_PROFILE',
    });

    return 'patient' in res ? res.patient : res;
  }

  /**
   * Get authenticated patient profile via real GET /patients/me.
   */
  public async getMyProfile(
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedPatientProfile> {
    const res = await simulationHttp.request<
      SimulatedPatientProfile | { profile: SimulatedPatientProfile }
    >('/patients/me', {
      method: 'GET',
      actor,
      runId,
      workflowEvent: 'FETCH_MY_PROFILE',
    });

    return 'profile' in res ? res.profile : res;
  }

  // -------------------------------------------------------------
  // 4. Appointments & Check-ins
  // -------------------------------------------------------------

  /**
   * Book an appointment via real POST /appointments.
   */
  public async bookAppointment(
    payload: {
      patientId: string;
      doctorId: string;
      startTime: string;
      endTime?: string;
      type?: string;
    },
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedAppointment> {
    const start = new Date(payload.startTime);
    const end = payload.endTime
      ? new Date(payload.endTime)
      : new Date(start.getTime() + 15 * 60 * 1000);

    const res = await simulationHttp.request<
      SimulatedAppointment | { appointment: SimulatedAppointment }
    >('/appointments', {
      method: 'POST',
      body: {
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        type: payload.type || 'CONSULTATION',
      },
      actor,
      runId,
      workflowEvent: 'BOOK_APPOINTMENT',
    });

    return 'appointment' in res ? res.appointment : res;
  }

  /**
   * Check in an appointment via real POST /appointments/:id/check-in.
   */
  public async checkInAppointment(
    appointmentId: string,
    actor: RequestActorContext,
    runId?: string
  ): Promise<{ visit?: SimulatedVisit; message?: string }> {
    return simulationHttp.request(`/appointments/${appointmentId}/check-in`, {
      method: 'POST',
      actor,
      runId,
      workflowEvent: 'CHECK_IN_APPOINTMENT',
    });
  }

  // -------------------------------------------------------------
  // 5. Visits & Vitals
  // -------------------------------------------------------------

  /**
   * Create a visit (for walk-ins or appointments) via real POST /visits.
   */
  public async createVisit(
    payload: {
      patientId: string;
      visitType: string;
      assignedDoctorId?: string | null;
      appointmentId?: string | null;
    },
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedVisit> {
    const res = await simulationHttp.request<SimulatedVisit | { visit: SimulatedVisit }>('/visits', {
      method: 'POST',
      body: {
        patientId: payload.patientId,
        visitType: payload.visitType,
        assignedDoctorId: payload.assignedDoctorId ?? null,
        appointmentId: payload.appointmentId ?? null,
      },
      actor,
      runId,
      workflowEvent: 'CREATE_VISIT',
    });

    return 'visit' in res ? res.visit : res;
  }

  /**
   * Advance or update visit status via real PATCH /visits/:id/status.
   */
  public async updateVisitStatus(
    visitId: string,
    status: SimulationVisitStatus,
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedVisit> {
    const res = await simulationHttp.request<SimulatedVisit | { visit: SimulatedVisit }>(
      `/visits/${visitId}/status`,
      {
        method: 'PATCH',
        body: { status },
        actor,
        runId,
        workflowEvent: `VISIT_STATUS_${status}`,
      }
    );

    return 'visit' in res ? res.visit : res;
  }

  /**
   * Get visit details via real GET /visits/:id.
   */
  public async getVisitById(
    visitId: string,
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedVisit> {
    const res = await simulationHttp.request<SimulatedVisit | { visit: SimulatedVisit }>(
      `/visits/${visitId}`,
      {
        method: 'GET',
        actor,
        runId,
        workflowEvent: 'FETCH_VISIT_DETAILS',
      }
    );

    return 'visit' in res ? res.visit : res;
  }

  /**
   * Record vitals for a visit via real POST /vitals.
   */
  public async recordVitals(
    payload: {
      visitId: string;
      heightCm?: number;
      weightKg?: number;
      bloodPressure?: string;
      temperatureC?: number;
      pulseBpm?: number;
      spo2Percent?: number;
    },
    actor: RequestActorContext,
    runId?: string
  ): Promise<{ id: string; visitId: string }> {
    return simulationHttp.request('/vitals', {
      method: 'POST',
      body: payload,
      actor,
      runId,
      workflowEvent: 'RECORD_VITALS',
    });
  }

  // -------------------------------------------------------------
  // 6. Queue Engine
  // -------------------------------------------------------------

  /**
   * Join a specific queue via real POST /queue/join.
   */
  public async joinQueue(
    payload: {
      visitId: string;
      queueType: string;
      doctorId?: string | null;
      departmentId?: string | null;
      priority?: number;
    },
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedQueueEntry> {
    const res = await simulationHttp.request<SimulatedQueueEntry | { queueEntry: SimulatedQueueEntry }>(
      '/queue/join',
      {
        method: 'POST',
        body: payload,
        actor,
        runId,
        workflowEvent: `JOIN_QUEUE_${payload.queueType}`,
      }
    );

    return 'queueEntry' in res ? res.queueEntry : res;
  }

  /**
   * Get authenticated patient's current queue position and status via real GET /queue/patient/me.
   */
  public async getMyPatientQueue(
    actor: RequestActorContext,
    runId?: string
  ): Promise<unknown> {
    return simulationHttp.request('/queue/patient/me', {
      method: 'GET',
      actor,
      runId,
      workflowEvent: 'FETCH_MY_QUEUE_STATUS',
    });
  }

  /**
   * Doctor calls next patient from their queue via real POST /queue/doctor/call-next.
   */
  public async doctorCallNext(
    doctorActor: RequestActorContext,
    runId?: string
  ): Promise<{ queueEntry?: SimulatedQueueEntry; message?: string }> {
    return simulationHttp.request('/queue/doctor/call-next', {
      method: 'POST',
      actor: doctorActor,
      runId,
      workflowEvent: 'DOCTOR_CALL_NEXT',
    });
  }

  /**
   * Doctor starts serving an active queue entry.
   */
  public async startServingQueueEntry(
    queueEntryId: string,
    doctorActor: RequestActorContext,
    runId?: string
  ): Promise<{ queueEntry?: SimulatedQueueEntry }> {
    return simulationHttp.request(`/queue/${queueEntryId}/start`, {
      method: 'POST',
      actor: doctorActor,
      runId,
      workflowEvent: 'START_CONSULTATION_QUEUE',
    });
  }

  /**
   * Complete a doctor queue entry via real POST /queue/:id/complete.
   */
  public async completeQueueEntry(
    queueEntryId: string,
    doctorActor: RequestActorContext,
    runId?: string
  ): Promise<{ queueEntry?: SimulatedQueueEntry }> {
    return simulationHttp.request(`/queue/${queueEntryId}/complete`, {
      method: 'POST',
      actor: doctorActor,
      runId,
      workflowEvent: 'COMPLETE_QUEUE_ENTRY',
    });
  }

  // -------------------------------------------------------------
  // 7. Clinical Consultations & Orders
  // -------------------------------------------------------------

  /**
   * Doctor records a consultation via real POST /consultations/patient/:patientId.
   */
  public async createConsultation(
    patientId: string,
    payload: {
      visitId?: string;
      appointmentId?: string;
      diagnosis: string;
      notes?: string;
      treatmentPlan?: string;
      prescriptions?: Array<{
        medication: string;
        dosage: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
      }>;
    },
    doctorActor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedConsultation> {
    const res = await simulationHttp.request<
      SimulatedConsultation | { consultation: SimulatedConsultation }
    >(`/consultations/patient/${patientId}`, {
      method: 'POST',
      body: payload,
      actor: doctorActor,
      runId,
      workflowEvent: 'RECORD_CONSULTATION',
    });

    return 'consultation' in res ? res.consultation : res;
  }

  /**
   * Doctor orders lab test via real POST /lab-orders.
   */
  public async createLabOrder(
    payload: {
      visitId: string;
      testName: string;
      instructions?: string;
    },
    staffActor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedLabOrder> {
    const res = await simulationHttp.request<SimulatedLabOrder | { labOrder: SimulatedLabOrder }>(
      '/lab-orders',
      {
        method: 'POST',
        body: payload,
        actor: staffActor,
        runId,
        workflowEvent: 'ORDER_LAB_TEST',
      }
    );

    return 'labOrder' in res ? res.labOrder : res;
  }

  /**
   * Lab technician records sample collection via real POST /lab-orders/:id/sample-collected.
   */
  public async recordSampleCollected(
    labOrderId: string,
    labTechActor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedLabOrder> {
    const res = await simulationHttp.request<SimulatedLabOrder | { labOrder: SimulatedLabOrder }>(
      `/lab-orders/${labOrderId}/sample-collected`,
      {
        method: 'POST',
        actor: labTechActor,
        runId,
        workflowEvent: 'LAB_SAMPLE_COLLECTED',
      }
    );

    return 'labOrder' in res ? res.labOrder : res;
  }

  /**
   * Lab technician enters test result via real POST /lab-orders/:id/report.
   */
  public async uploadLabReport(
    labOrderId: string,
    result: string,
    labTechActor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedLabOrder> {
    const res = await simulationHttp.request<SimulatedLabOrder | { labOrder: SimulatedLabOrder }>(
      `/lab-orders/${labOrderId}/report`,
      {
        method: 'POST',
        body: { result },
        actor: labTechActor,
        runId,
        workflowEvent: 'LAB_REPORT_COMPLETED',
      }
    );

    return 'labOrder' in res ? res.labOrder : res;
  }

  /**
   * Patient queries their diagnostic reports via real GET /patients/me/reports.
   */
  public async getMyReports(
    actor: RequestActorContext,
    runId?: string
  ): Promise<unknown[]> {
    const res = await simulationHttp.request<unknown[] | { reports: unknown[] }>(
      '/patients/me/reports',
      {
        method: 'GET',
        actor,
        runId,
        workflowEvent: 'FETCH_MY_REPORTS',
      }
    );
    return Array.isArray(res) ? res : (res as any).reports || [];
  }

  // -------------------------------------------------------------
  // 8. Pharmacy Dispensing
  // -------------------------------------------------------------

  /**
   * Query prescriptions queue via real GET /prescriptions.
   */
  public async getPrescriptions(
    status?: string,
    pharmacistActor?: RequestActorContext,
    runId?: string
  ): Promise<SimulatedPrescription[]> {
    const query = status ? `?status=${status}` : '';
    const res = await simulationHttp.request<
      SimulatedPrescription[] | { prescriptions: SimulatedPrescription[] }
    >(`/prescriptions${query}`, {
      method: 'GET',
      actor: pharmacistActor,
      runId,
      workflowEvent: 'QUERY_PRESCRIPTIONS',
    });

    if (Array.isArray(res)) return res;
    return res.prescriptions || [];
  }

  /**
   * Patient queries their own prescriptions via real GET /patients/me/prescriptions.
   */
  public async getMyPrescriptions(
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedPrescription[]> {
    const res = await simulationHttp.request<
      SimulatedPrescription[] | { prescriptions: SimulatedPrescription[] }
    >('/patients/me/prescriptions', {
      method: 'GET',
      actor,
      runId,
      workflowEvent: 'FETCH_MY_PRESCRIPTIONS',
    });
    return Array.isArray(res) ? res : (res as any).prescriptions || [];
  }

  /**
   * Pharmacist dispenses medication via real PATCH /prescriptions/:id/dispense.
   */
  public async dispensePrescription(
    prescriptionId: string,
    payload: { quantity?: string; notes?: string },
    pharmacistActor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedPrescription> {
    const res = await simulationHttp.request<
      SimulatedPrescription | { prescription: SimulatedPrescription }
    >(`/prescriptions/${prescriptionId}/dispense`, {
      method: 'PATCH',
      body: payload,
      actor: pharmacistActor,
      runId,
      workflowEvent: 'PHARMACY_DISPENSE',
    });

    return 'prescription' in res ? res.prescription : res;
  }

  // -------------------------------------------------------------
  // 9. Billing & Cash Settlement
  // -------------------------------------------------------------

  /**
   * Patient queues at cash counter to settle invoice via real POST /billing/cash-queue.
   */
  public async joinCashCounterQueue(
    visitId: string,
    actor: RequestActorContext,
    runId?: string
  ): Promise<{ id: string; invoiceId?: string; invoice_id?: string; message?: string }> {
    return simulationHttp.request('/billing/cash-queue', {
      method: 'POST',
      body: { visitId },
      actor,
      runId,
      workflowEvent: 'JOIN_CASH_COUNTER_QUEUE',
    });
  }

  /**
   * Patient or billing clerk fetches invoices for a visit via real GET /visits/:visitId/invoices.
   */
  public async getVisitInvoices(
    visitId: string,
    actor: RequestActorContext,
    runId?: string
  ): Promise<{ invoices: SimulatedInvoice[] }> {
    return simulationHttp.request(`/visits/${visitId}/invoices`, {
      method: 'GET',
      actor,
      runId,
      workflowEvent: 'FETCH_VISIT_INVOICES',
    });
  }

  /**
   * Billing clerk generates invoice for visit via real POST /visits/:visitId/invoice.
   */
  public async generateInvoice(
    visitId: string,
    payload: {
      items?: Array<{ description: string; itemType: string; amount: number }>;
    },
    staffActor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedInvoice> {
    const res = await simulationHttp.request<SimulatedInvoice | { invoice: SimulatedInvoice }>(
      `/visits/${visitId}/invoice`,
      {
        method: 'POST',
        body: payload,
        actor: staffActor,
        runId,
        workflowEvent: 'GENERATE_INVOICE',
      }
    );

    return 'invoice' in res ? res.invoice : res;
  }

  /**
   * Billing clerk settles invoice via cash counter payment via real PATCH /invoices/:id/pay.
   */
  public async payInvoice(
    invoiceId: string,
    staffActor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedInvoice> {
    const res = await simulationHttp.request<SimulatedInvoice | { invoice: SimulatedInvoice }>(
      `/invoices/${invoiceId}/pay`,
      {
        method: 'PATCH',
        actor: staffActor,
        runId,
        workflowEvent: 'INVOICE_SETTLED_CASH',
      }
    );

    return 'invoice' in res ? res.invoice : res;
  }

  // -------------------------------------------------------------
  // 10. Workflow Engine Tasks & Dependencies
  // -------------------------------------------------------------

  /**
   * Create a workflow task via real POST /workflow/tasks.
   */
  public async createWorkflowTask(
    payload: {
      visitId: string;
      taskType: string;
      priority?: number;
      departmentId?: string;
      dependsOnTaskIds?: string[];
    },
    actor: RequestActorContext,
    runId?: string
  ): Promise<SimulatedWorkflowTask> {
    const res = await simulationHttp.request<
      SimulatedWorkflowTask | { task: SimulatedWorkflowTask }
    >('/workflow/tasks', {
      method: 'POST',
      body: payload,
      actor,
      runId,
      workflowEvent: `WORKFLOW_TASK_CREATED_${payload.taskType}`,
    });

    return 'task' in res ? res.task : res;
  }

  /**
   * Complete a workflow task, triggering atomic unblocking of dependent tasks.
   */
  public async completeWorkflowTask(
    taskId: string,
    actor: RequestActorContext,
    runId?: string
  ): Promise<{ completedTask: SimulatedWorkflowTask; unblockedTasks: SimulatedWorkflowTask[] }> {
    return simulationHttp.request(`/workflow/tasks/${taskId}/complete`, {
      method: 'POST',
      actor,
      runId,
      workflowEvent: 'WORKFLOW_TASK_COMPLETED',
    });
  }

  /**
   * Inspect current workflow graph and tasks for a visit via GET /workflow/visits/:visitId.
   */
  public async getVisitWorkflow(
    visitId: string,
    actor: RequestActorContext,
    runId?: string
  ): Promise<{
    tasks: SimulatedWorkflowTask[];
    summary: {
      total: number;
      blocked: number;
      waiting: number;
      inProgress: number;
      completed: number;
      cancelled: number;
    };
  }> {
    return simulationHttp.request(`/workflow/visits/${visitId}`, {
      method: 'GET',
      actor,
      runId,
      workflowEvent: 'QUERY_VISIT_WORKFLOW',
    });
  }
}

export const simulationApi = new SimulationApiService();
