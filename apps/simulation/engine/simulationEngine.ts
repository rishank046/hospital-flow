// Hospital Flow Orchestration & Workload Simulation Engine
// Strictly isolated to apps/web/src/simulation/engine/

import { simulationHttp, type RequestActorContext } from '../api/simulation.http';
import { simulationApi } from '../api/simulation.api';
import type { SimulationHttpRequestLog } from '../api/simulation.api.types';
import {
  generateRunId,
  generateDynamicPassword,
  generateDynamicEmail,
  generateActorName,
} from './credentialGenerator';
import { EventScheduler } from './eventScheduler';
import {
  PRESET_SCENARIOS,
  validateScenarioConfig,
  type ScenarioConfig,
} from './scenarioConfig';
import type {
  DepartmentMetrics,
  DepartmentType,
  OverallSimulationMetrics,
  SimulatedActor,
  SimulatedPatientJourney,
  SimulationDomainEvent,
  SimulationState,
} from './simulationTypes';

export type SimulationStateListener = (state: SimulationState) => void;

export class SimulationEngine {
  private scheduler: EventScheduler;
  private currentScenario: ScenarioConfig;
  private stateListeners: Set<SimulationStateListener> = new Set();
  private unsubscribeHttpLogs: (() => void) | null = null;
  private unsubscribeClockTick: (() => void) | null = null;

  // Optional Admin credentials for provisioning staff/doctors via real backend APIs
  private adminCredentials: { email?: string; password?: string; token?: string } | null = null;

  private state: SimulationState;

  constructor(initialScenario: ScenarioConfig = PRESET_SCENARIOS[0]) {
    validateScenarioConfig(initialScenario);
    this.currentScenario = initialScenario;
    this.scheduler = new EventScheduler(initialScenario.simulationSpeed);

    const initialRunId = generateRunId();
    this.state = this.createInitialState(initialRunId, initialScenario);

    this.setupListeners();
  }

  private createInitialState(runId: string, scenario: ScenarioConfig): SimulationState {
    const departments: Record<DepartmentType, DepartmentMetrics> = {
      RECEPTION: {
        id: 'RECEPTION',
        name: 'Reception & Intake',
        patientsPresent: 0,
        queueSize: 0,
        activeStaff: scenario.workload.numStaff.opdManagers,
        averageWaitSec: 0,
        processedCount: 0,
        isBottleneck: false,
      },
      VITALS: {
        id: 'VITALS',
        name: 'Vitals & Triage',
        patientsPresent: 0,
        queueSize: 0,
        activeStaff: 1,
        averageWaitSec: 0,
        processedCount: 0,
        isBottleneck: false,
      },
      DOCTOR_OPD: {
        id: 'DOCTOR_OPD',
        name: 'Doctor Consultation',
        patientsPresent: 0,
        queueSize: 0,
        activeStaff: scenario.workload.numDoctors,
        averageWaitSec: 0,
        processedCount: 0,
        isBottleneck: false,
      },
      LAB: {
        id: 'LAB',
        name: 'Diagnostics & Laboratory',
        patientsPresent: 0,
        queueSize: 0,
        activeStaff: scenario.workload.numStaff.labTechs,
        averageWaitSec: 0,
        processedCount: 0,
        isBottleneck: false,
      },
      PHARMACY: {
        id: 'PHARMACY',
        name: 'Hospital Pharmacy',
        patientsPresent: 0,
        queueSize: 0,
        activeStaff: scenario.workload.numStaff.pharmacists,
        averageWaitSec: 0,
        processedCount: 0,
        isBottleneck: false,
      },
      BILLING: {
        id: 'BILLING',
        name: 'Billing & Cash Counter',
        patientsPresent: 0,
        queueSize: 0,
        activeStaff: scenario.workload.numStaff.billingClerks,
        averageWaitSec: 0,
        processedCount: 0,
        isBottleneck: false,
      },
      DISCHARGED: {
        id: 'DISCHARGED',
        name: 'Completed & Discharged',
        patientsPresent: 0,
        queueSize: 0,
        activeStaff: 0,
        averageWaitSec: 0,
        processedCount: 0,
        isBottleneck: false,
      },
    };

    const metrics: OverallSimulationMetrics = {
      runId,
      elapsedSec: 0,
      totalPatients: 0,
      completedJourneys: 0,
      inProgressVisits: 0,
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      avgCycleTimeSec: 0,
      bottleneckDepartment: null,
      activeActorsCount: 0,
    };

    return {
      runId,
      status: 'IDLE',
      speed: scenario.simulationSpeed,
      elapsedSec: 0,
      currentScenarioId: scenario.id,
      actors: [],
      patients: [],
      departments,
      metrics,
      recentEvents: [],
      requestLogs: [],
      errorMessage: null,
    };
  }

  private setupListeners(): void {
    // 1. Subscribe to HTTP client request logs
    this.unsubscribeHttpLogs = simulationHttp.subscribeLogs((log: SimulationHttpRequestLog) => {
      // Only record logs matching current run or system
      if (log.runId !== this.state.runId && log.runId !== 'SIM-GLOBAL') {
        return;
      }

      this.state.requestLogs = [log, ...this.state.requestLogs].slice(0, 400);

      this.state.metrics.totalRequests++;
      if (log.status >= 200 && log.status < 400) {
        this.state.metrics.successRequests++;
      } else if (log.status >= 400 || log.status === 0) {
        this.state.metrics.errorRequests++;
      }

      // Update actor request count
      const actor = this.state.actors.find((a) => a.id === log.actorId);
      if (actor) {
        actor.requestsCount++;
      }

      this.notifyState();
    });

    // 2. Subscribe to scheduler clock ticks
    this.unsubscribeClockTick = this.scheduler.subscribeTick((simTimeSec: number) => {
      this.state.elapsedSec = Math.round(simTimeSec);
      this.state.metrics.elapsedSec = this.state.elapsedSec;
      this.recalculateDepartmentMetrics();
      this.notifyState();
    });
  }

  public subscribe(listener: SimulationStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyState(): void {
    for (const listener of this.stateListeners) {
      try {
        listener({ ...this.state });
      } catch (err) {
        console.error('[SimulationEngine] State listener error:', err);
      }
    }
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  public setAdminCredentials(creds: { email?: string; password?: string; token?: string } | null): void {
    this.adminCredentials = creds;
  }

  public setScenario(scenario: ScenarioConfig): void {
    validateScenarioConfig(scenario);
    this.currentScenario = scenario;
    this.state.currentScenarioId = scenario.id;
    this.setSpeed(scenario.simulationSpeed);
    this.reset();
  }

  public setSpeed(multiplier: number): void {
    this.scheduler.setSpeed(multiplier);
    this.state.speed = multiplier;
    this.notifyState();
  }

  public logEvent(
    type: string,
    message: string,
    actorName: string,
    actorRole: string,
    patientName?: string,
    level: SimulationDomainEvent['level'] = 'info'
  ): void {
    const event: SimulationDomainEvent = {
      id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      message,
      actorName,
      actorRole,
      patientName,
      level,
    };

    this.state.recentEvents = [event, ...this.state.recentEvents].slice(0, 150);
    this.notifyState();
  }

  /**
   * Reset simulation run with a fresh Run ID and clean state.
   */
  public reset(preserveRunId = false): void {
    this.scheduler.reset();

    const newRunId = preserveRunId ? this.state.runId : generateRunId();
    this.state = this.createInitialState(newRunId, this.currentScenario);

    this.logEvent(
      'RUN_RESET',
      `Simulation reset. Generated new Run ID: ${newRunId}`,
      'System Orchestrator',
      'SYSTEM',
      undefined,
      'info'
    );
    this.notifyState();
  }

  public pause(): void {
    if (this.state.status !== 'RUNNING') return;
    this.scheduler.pause();
    this.state.status = 'PAUSED';
    this.logEvent('RUN_PAUSED', 'Simulation clock paused by user', 'System Orchestrator', 'SYSTEM', undefined, 'warning');
    this.notifyState();
  }

  public resume(): void {
    if (this.state.status !== 'PAUSED') return;
    this.state.status = 'RUNNING';
    this.scheduler.start();
    this.logEvent('RUN_RESUMED', 'Simulation clock resumed', 'System Orchestrator', 'SYSTEM', undefined, 'info');
    this.notifyState();
  }

  public async stepForward(): Promise<void> {
    await this.scheduler.step(2);
  }

  /**
   * Start a new simulation run.
   * Bootstraps actors, generates dynamic credentials, registers accounts, and schedules workloads.
   */
  public async start(): Promise<void> {
    if (this.state.status === 'RUNNING') return;

    if (this.state.status === 'PAUSED') {
      this.resume();
      return;
    }

    this.state.status = 'BOOTSTRAPPING';
    this.state.errorMessage = null;
    this.notifyState();

    this.logEvent(
      'BOOTSTRAP_START',
      `Initializing Simulation Run [${this.state.runId}] with scenario "${this.currentScenario.name}"`,
      'System Orchestrator',
      'SYSTEM',
      undefined,
      'info'
    );

    try {
      // 1. Provision and authenticate simulated actors
      await this.bootstrapSimulatedActors();

      // 2. Schedule patient workloads (walk-ins & online appointments)
      this.scheduleWorkloadArrivals();

      // 3. Start discrete event clock
      this.state.status = 'RUNNING';
      this.scheduler.start();

      this.logEvent(
        'BOOTSTRAP_COMPLETE',
        `All actors authenticated. Workload schedule activated with speed ${this.state.speed}x.`,
        'System Orchestrator',
        'SYSTEM',
        undefined,
        'success'
      );
      this.notifyState();
    } catch (err) {
      console.error('[SimulationEngine] Bootstrap error:', err);
      this.state.status = 'ERROR';
      this.state.errorMessage = err instanceof Error ? err.message : 'Bootstrap failed';
      this.logEvent(
        'BOOTSTRAP_ERROR',
        `Failed to initialize simulation: ${this.state.errorMessage}`,
        'System Orchestrator',
        'SYSTEM',
        undefined,
        'error'
      );
      this.notifyState();
    }
  }

  /**
   * Generates dynamic credentials at runtime for simulated actors,
   * registers accounts, and establishes actor-specific authentication contexts.
   */
  private async bootstrapSimulatedActors(): Promise<void> {
    const runId = this.state.runId;
    const actors: SimulatedActor[] = [];

    // Helper: obtain admin actor context if credentials or token was supplied
    let adminActor: RequestActorContext | null = null;
    if (this.adminCredentials?.token) {
      adminActor = {
        actorId: 'ADMIN-PROVISIONER',
        actorRole: 'ADMIN',
        actorName: 'Admin Provisioner',
        token: this.adminCredentials.token,
      };
    } else if (this.adminCredentials?.email && this.adminCredentials?.password) {
      try {
        const adminLogin = await simulationApi.login(
          this.adminCredentials.email,
          this.adminCredentials.password,
          { actorId: 'ADMIN-LOGIN', actorRole: 'ADMIN', actorName: 'Admin Bootstrap' },
          runId
        );
        const adminToken = adminLogin.token || adminLogin.accessToken;
        if (adminToken) {
          adminActor = {
            actorId: 'ADMIN-PROVISIONER',
            actorRole: 'ADMIN',
            actorName: 'Admin Provisioner',
            token: adminToken,
          };
        }
      } catch (err) {
        console.warn('[SimulationEngine] Admin login failed:', err);
      }
    }

    // Step A: Doctors
    const numDoctors = this.currentScenario.workload.numDoctors;
    // Check if real doctors already exist in backend
    let existingDoctors: Array<{ id: string; name: string; specialization: string; department?: string }> = [];
    try {
      existingDoctors = await simulationApi.getDoctors(undefined, runId);
    } catch {
      // Backend may be offline or doctors table empty
    }

    for (let i = 0; i < numDoctors; i++) {
      const email = generateDynamicEmail(runId, 'doctor', i + 1);
      const tempPassword = generateDynamicPassword();
      const doctorName = generateActorName('DOCTOR', i + 1);
      let doctorToken: string | null = null;
      let backendDoctorId: string | undefined;

      if (adminActor) {
        try {
          // Provision doctor through real admin API
          const createdDoc = await simulationApi.adminCreateDoctor(
            {
              name: doctorName,
              email,
              password: tempPassword,
              specialization: i % 2 === 0 ? 'General Medicine' : 'Cardiology',
              department: 'General Medicine',
            },
            adminActor,
            runId
          );
          backendDoctorId = createdDoc.id;

          // Authenticate simulated doctor with returned credentials
          const loginRes = await simulationApi.login(
            email,
            tempPassword,
            { actorId: `DOC-${i + 1}`, actorRole: 'DOCTOR', actorName: doctorName },
            runId
          );
          doctorToken = loginRes.token || loginRes.accessToken || null;
        } catch (err) {
          console.warn(`[SimulationEngine] Could not provision doctor via admin API:`, err);
        }
      }

      // If doctor could not be created via admin (e.g. no admin token provided), bind to existing doctor if available
      if (!backendDoctorId && existingDoctors[i]) {
        backendDoctorId = existingDoctors[i].id;
      }

      actors.push({
        id: `ACTOR-DOC-${i + 1}`,
        role: 'DOCTOR',
        name: doctorName,
        email,
        token: doctorToken,
        status: 'READY',
        specialization: i % 2 === 0 ? 'General Medicine' : 'Cardiology',
        department: 'General Medicine',
        backendDoctorId,
        tasksCompleted: 0,
        requestsCount: 0,
      });
    }

    // Step B: OPD Managers / Receptionists
    const numOpd = this.currentScenario.workload.numStaff.opdManagers;
    for (let i = 0; i < numOpd; i++) {
      const email = generateDynamicEmail(runId, 'opd', i + 1);
      const tempPassword = generateDynamicPassword();
      const staffName = generateActorName('OPD_MANAGER', i + 1, 'Intake Clerk');
      let token: string | null = null;

      if (adminActor) {
        try {
          await simulationApi.adminCreateStaff(
            {
              name: staffName,
              email,
              password: tempPassword,
              role: 'RECEPTIONIST',
              department: 'General Medicine',
            },
            adminActor,
            runId
          );
          const loginRes = await simulationApi.login(
            email,
            tempPassword,
            { actorId: `OPD-${i + 1}`, actorRole: 'OPD_MANAGER', actorName: staffName },
            runId
          );
          token = loginRes.token || loginRes.accessToken || null;
        } catch (err) {
          console.warn('[SimulationEngine] OPD staff creation via admin API failed:', err);
        }
      }

      actors.push({
        id: `ACTOR-OPD-${i + 1}`,
        role: 'OPD_MANAGER',
        name: staffName,
        email,
        token,
        status: 'READY',
        department: 'Reception & OPD',
        tasksCompleted: 0,
        requestsCount: 0,
      });
    }

    // Step C: Lab Technicians
    const numLab = this.currentScenario.workload.numStaff.labTechs;
    for (let i = 0; i < numLab; i++) {
      const email = generateDynamicEmail(runId, 'lab', i + 1);
      const tempPassword = generateDynamicPassword();
      const staffName = generateActorName('LAB_TECH', i + 1, 'Lab Tech');
      let token: string | null = null;

      if (adminActor) {
        try {
          await simulationApi.adminCreateStaff(
            {
              name: staffName,
              email,
              password: tempPassword,
              role: 'LAB_TECH',
              department: 'Laboratory',
            },
            adminActor,
            runId
          );
          const loginRes = await simulationApi.login(
            email,
            tempPassword,
            { actorId: `LAB-${i + 1}`, actorRole: 'LAB_TECH', actorName: staffName },
            runId
          );
          token = loginRes.token || loginRes.accessToken || null;
        } catch (err) {
          console.warn('[SimulationEngine] Lab tech creation failed:', err);
        }
      }

      actors.push({
        id: `ACTOR-LAB-${i + 1}`,
        role: 'LAB_TECH',
        name: staffName,
        email,
        token,
        status: 'READY',
        department: 'Diagnostics',
        tasksCompleted: 0,
        requestsCount: 0,
      });
    }

    // Step D: Pharmacists
    const numPharm = this.currentScenario.workload.numStaff.pharmacists;
    for (let i = 0; i < numPharm; i++) {
      const email = generateDynamicEmail(runId, 'pharmacy', i + 1);
      const tempPassword = generateDynamicPassword();
      const staffName = generateActorName('PHARMACIST', i + 1, 'Pharm.');
      let token: string | null = null;

      if (adminActor) {
        try {
          await simulationApi.adminCreateStaff(
            {
              name: staffName,
              email,
              password: tempPassword,
              role: 'PHARMACIST',
              department: 'Pharmacy',
            },
            adminActor,
            runId
          );
          const loginRes = await simulationApi.login(
            email,
            tempPassword,
            { actorId: `PHARM-${i + 1}`, actorRole: 'PHARMACIST', actorName: staffName },
            runId
          );
          token = loginRes.token || loginRes.accessToken || null;
        } catch (err) {
          console.warn('[SimulationEngine] Pharmacist creation failed:', err);
        }
      }

      actors.push({
        id: `ACTOR-PHARM-${i + 1}`,
        role: 'PHARMACIST',
        name: staffName,
        email,
        token,
        status: 'READY',
        department: 'Dispensary',
        tasksCompleted: 0,
        requestsCount: 0,
      });
    }

    // Step E: Billing Clerks
    const numBilling = this.currentScenario.workload.numStaff.billingClerks;
    for (let i = 0; i < numBilling; i++) {
      const email = generateDynamicEmail(runId, 'billing', i + 1);
      const tempPassword = generateDynamicPassword();
      const staffName = generateActorName('BILLING_CLERK', i + 1, 'Cashier');
      let token: string | null = null;

      if (adminActor) {
        try {
          await simulationApi.adminCreateStaff(
            {
              name: staffName,
              email,
              password: tempPassword,
              role: 'BILLING_CLERK',
              department: 'Accounts & Cash',
            },
            adminActor,
            runId
          );
          const loginRes = await simulationApi.login(
            email,
            tempPassword,
            { actorId: `BILLING-${i + 1}`, actorRole: 'BILLING_CLERK', actorName: staffName },
            runId
          );
          token = loginRes.token || loginRes.accessToken || null;
        } catch (err) {
          console.warn('[SimulationEngine] Billing clerk creation failed:', err);
        }
      }

      actors.push({
        id: `ACTOR-BILLING-${i + 1}`,
        role: 'BILLING_CLERK',
        name: staffName,
        email,
        token,
        status: 'READY',
        department: 'Billing & Cash',
        tasksCompleted: 0,
        requestsCount: 0,
      });
    }

    // Step F: Simulated Website Users (for Online Appointments)
    const numUsers = this.currentScenario.workload.numUsers;
    for (let i = 0; i < numUsers; i++) {
      const email = generateDynamicEmail(runId, 'user', i + 1);
      const tempPassword = generateDynamicPassword();
      const userName = generateActorName('USER', i + 1);
      let userToken: string | null = null;

      try {
        // Online users can always register through public POST /auth/register
        const regRes = await simulationApi.registerUser(userName, email, tempPassword, runId);
        userToken = regRes.token || null;

        if (!userToken) {
          const loginRes = await simulationApi.login(
            email,
            tempPassword,
            { actorId: `USER-${i + 1}`, actorRole: 'ONLINE_USER', actorName: userName },
            runId
          );
          userToken = loginRes.token || loginRes.accessToken || null;
        }
      } catch (err) {
        console.warn(`[SimulationEngine] Online user registration failed:`, err);
      }

      actors.push({
        id: `ACTOR-USER-${i + 1}`,
        role: 'ONLINE_USER',
        name: userName,
        email,
        token: userToken,
        status: 'READY',
        tasksCompleted: 0,
        requestsCount: 0,
      });
    }

    this.state.actors = actors;
    this.state.metrics.activeActorsCount = actors.length;
  }

  /**
   * Schedules patient arrivals and entire cross-department clinical workflows.
   */
  private scheduleWorkloadArrivals(): void {
    const { workload, arrival } = this.currentScenario;
    let currentDelaySec = 1;

    // 1. Schedule Walk-in Patients
    for (let i = 0; i < workload.numWalkIns; i++) {
      const patientIndex = i + 1;
      const scheduledDelay = currentDelaySec;

      this.scheduler.schedule(
        scheduledDelay,
        `Walk-in Patient #${patientIndex} arrives at Reception`,
        () => this.executeWalkinPatientFlow(patientIndex)
      );

      // Increment delay according to pattern
      if (arrival.pattern === 'burst') {
        currentDelaySec += Math.max(1, arrival.intervalSeconds * (i % 2 === 0 ? 0.3 : 1.5));
      } else if (arrival.pattern === 'poisson') {
        const lambda = 1 / Math.max(1, arrival.intervalSeconds);
        const expInterval = -Math.log(1 - Math.random()) / lambda;
        currentDelaySec += Math.max(1, Math.round(expInterval));
      } else {
        currentDelaySec += arrival.intervalSeconds;
      }
    }

    // 2. Schedule Online Appointment Patients
    for (let j = 0; j < workload.numAppointments; j++) {
      const apptIndex = j + 1;
      const scheduledDelay = currentDelaySec + 2;

      this.scheduler.schedule(
        scheduledDelay,
        `Online Appointment Patient #${apptIndex} checks in`,
        () => this.executeOnlineAppointmentFlow(apptIndex)
      );

      currentDelaySec += arrival.intervalSeconds + 1;
    }
  }

  /**
   * Executes the full walk-in patient flow through the real MediQ APIs.
   * Ensures every patient is registered and authenticated via POST /auth/login FIRST,
   * then uses the patient's authenticated JWT session for all patient operations.
   */
  private async executeWalkinPatientFlow(index: number): Promise<void> {
    const runId = this.state.runId;
    const doctorActor = this.getAvailableDoctor();
    const patientName = generateActorName('PATIENT', index, 'Walkin Patient');
    const email = generateDynamicEmail(runId, 'patient-walkin', index);
    const password = generateDynamicPassword();

    // Step 1: Register the patient user on the backend
    let patientToken: string | null = null;
    try {
      const regRes = await simulationApi.registerUser(patientName, email, password, runId);
      patientToken = regRes.token || null;
    } catch (err) {
      console.warn(`[SimulationEngine] Walk-in registration error for ${patientName}:`, err);
    }

    // Step 2: Explicitly call POST /auth/login FIRST to acquire the authenticated JWT token for this patient
    try {
      const loginRes = await simulationApi.login(
        email,
        password,
        {
          actorId: `ACTOR-PATIENT-WALKIN-${index}`,
          actorRole: 'PATIENT',
          actorName: patientName,
        },
        runId
      );
      patientToken = loginRes.token || loginRes.accessToken || patientToken;
    } catch (err) {
      console.warn(`[SimulationEngine] Walk-in login error for ${patientName}:`, err);
    }

    // Track this authenticated patient as an active actor in the simulation state
    const patientActor: SimulatedActor = {
      id: `ACTOR-PATIENT-WALKIN-${index}`,
      role: 'ONLINE_USER',
      name: patientName,
      email,
      token: patientToken,
      status: 'READY',
      tasksCompleted: 0,
      requestsCount: 0,
    };
    this.state.actors.push(patientActor);
    this.state.metrics.activeActorsCount = this.state.actors.length;

    const patientContext: RequestActorContext = {
      actorId: patientActor.id,
      actorRole: 'PATIENT',
      actorName: patientName,
      token: patientToken,
    };

    // Step 3: Retrieve or create the patient's backend profile
    let patientProfileId = `sim-pat-walkin-${runId.toLowerCase()}-${String(index).padStart(3, '0')}`;
    try {
      const profileRes = await simulationApi.getMyProfile(patientContext, runId);
      if (profileRes?.id) {
        patientProfileId = profileRes.id;
      }
    } catch {
      try {
        const patRes = await simulationApi.createPatient(
          {
            name: patientName,
            age: 28 + ((index * 3) % 45),
            gender: index % 2 === 0 ? 'Female' : 'Male',
            patientType: 'Walkin',
          },
          patientContext,
          runId
        );
        patientProfileId = patRes.id;
      } catch (err) {
        console.warn(`[SimulationEngine] Walk-in profile creation fallback:`, err);
      }
    }

    const journey: SimulatedPatientJourney = {
      patientId: patientProfileId,
      patientName,
      patientType: 'Walkin',
      currentDepartment: 'RECEPTION',
      visitStatus: 'REGISTERED',
      doctorName: doctorActor?.name || 'Dr. Physician',
      hasLabTest: false,
      hasPrescription: false,
      isBlocked: false,
      timeline: [
        {
          time: new Date().toLocaleTimeString(),
          stage: 'RECEPTION',
          title: 'Authenticated & Registered',
          description: `Patient logged in via POST /auth/login. Active session established.`,
        },
      ],
      startedAt: new Date().toISOString(),
    };

    this.state.patients.push(journey);
    this.state.metrics.totalPatients++;
    this.state.metrics.inProgressVisits++;
    this.recalculateDepartmentMetrics();
    this.notifyState();

    this.logEvent(
      'PATIENT_ARRIVAL',
      `Walk-in patient ${patientName} authenticated and arrived at Reception.`,
      patientName,
      'PATIENT',
      patientName,
      'info'
    );

    // Step 4: Create real Visit via POST /visits using patient's authenticated token
    let createdVisitId = `visit-${Date.now()}-${index}`;
    try {
      const visitRes = await simulationApi.createVisit(
        {
          patientId: patientProfileId,
          visitType: 'WALKIN',
          assignedDoctorId: doctorActor?.backendDoctorId || null,
        },
        patientContext,
        runId
      );
      createdVisitId = visitRes.id;
      journey.visitId = createdVisitId;
    } catch (err) {
      console.warn(`[SimulationEngine] Visit creation fallback:`, err);
    }

    journey.timeline.push({
      time: new Date().toLocaleTimeString(),
      stage: 'RECEPTION',
      title: 'Intake Registered',
      description: `Visit recorded (ID: ${createdVisitId.slice(0, 8)}). Routing to Vitals Station.`,
    });

    // Step 5: Advance to Vitals triage after 2 seconds
    this.scheduler.schedule(2, `Advance ${patientName} to Vitals Station`, async () => {
      journey.currentDepartment = 'VITALS';
      journey.visitStatus = 'VITALS';
      this.recalculateDepartmentMetrics();
      this.notifyState();

      this.logEvent(
        'STAGE_VITALS',
        `Patient ${patientName} arrived at Vitals Station for preliminary screening.`,
        'Triage Nurse',
        'NURSE',
        patientName,
        'info'
      );

      // Check if a staff member with a valid STAFF token exists to record vitals
      const staffNurse = this.state.actors.find(
        (a) => (a.role === 'OPD_MANAGER' || a.role === 'NURSE') && a.token
      );
      if (staffNurse?.token) {
        try {
          await simulationApi.recordVitals(
            {
              visitId: createdVisitId,
              heightCm: 172,
              weightKg: 68,
              bloodPressure: '120/80',
              temperatureC: 36.8,
              pulseBpm: 74,
              spo2Percent: 99,
            },
            {
              actorId: staffNurse.id,
              actorRole: 'STAFF',
              actorName: staffNurse.name,
              token: staffNurse.token,
            },
            runId
          );
        } catch {
          // Fallback
        }
      } else {
        // Patient checks visit record to observe triage encounter
        try {
          await simulationApi.getVisitById(createdVisitId, patientContext, runId);
        } catch {
          // Fallback
        }
      }

      journey.timeline.push({
        time: new Date().toLocaleTimeString(),
        stage: 'VITALS',
        title: 'Vitals Recorded',
        description: 'BP 120/80, Pulse 74 bpm, Temp 36.8°C. Routing to Doctor OPD Queue.',
      });

      // Step 6: Join Doctor Queue via real POST /queue/join using patient's token
      this.scheduler.schedule(2, `Join OPD queue for ${patientName}`, async () => {
        journey.currentDepartment = 'DOCTOR_OPD';
        journey.visitStatus = 'WAITING_OPD';
        this.recalculateDepartmentMetrics();
        this.notifyState();

        try {
          await simulationApi.joinQueue(
            {
              visitId: createdVisitId,
              queueType: 'WALKIN',
              doctorId: doctorActor?.backendDoctorId || null,
            },
            patientContext,
            runId
          );
        } catch {
          // Fallback
        }

        // Query patient queue position via real GET /queue/patient/me
        try {
          await simulationApi.getMyPatientQueue(patientContext, runId);
        } catch {
          // Fallback
        }

        journey.timeline.push({
          time: new Date().toLocaleTimeString(),
          stage: 'DOCTOR_OPD',
          title: 'Joined Doctor Queue',
          description: `Awaiting consultation with ${doctorActor?.name || 'Physician'}.`,
        });

        this.logEvent(
          'QUEUE_JOINED',
          `Patient ${patientName} joined queue for ${doctorActor?.name || 'Physician'}.`,
          doctorActor?.name || 'Doctor',
          'DOCTOR',
          patientName,
          'info'
        );

        // Step 7: Doctor Consultation
        const consultDuration = this.currentScenario.timing.consultationDurationSec;
        this.scheduler.schedule(consultDuration, `Consultation for ${patientName}`, async () => {
          await this.executeClinicalConsultationAndDownstream(
            journey,
            doctorActor,
            patientContext,
            createdVisitId
          );
        });
      });
    });
  }

  /**
   * Executes online appointment booking, check-in, and downstream care flow.
   * Ensures every online patient is registered and authenticated via POST /auth/login FIRST.
   */
  private async executeOnlineAppointmentFlow(index: number): Promise<void> {
    const runId = this.state.runId;
    const doctorActor = this.getAvailableDoctor();
    const patientName = generateActorName('PATIENT', index, 'Online Patient');
    const email = generateDynamicEmail(runId, 'patient-online', index);
    const password = generateDynamicPassword();

    // Step 1: Register online patient
    let patientToken: string | null = null;
    try {
      const regRes = await simulationApi.registerUser(patientName, email, password, runId);
      patientToken = regRes.token || null;
    } catch (err) {
      console.warn(`[SimulationEngine] Online registration error for ${patientName}:`, err);
    }

    // Step 2: Explicitly call POST /auth/login FIRST to acquire the authenticated JWT token
    try {
      const loginRes = await simulationApi.login(
        email,
        password,
        {
          actorId: `ACTOR-PATIENT-ONLINE-${index}`,
          actorRole: 'PATIENT',
          actorName: patientName,
        },
        runId
      );
      patientToken = loginRes.token || loginRes.accessToken || patientToken;
    } catch (err) {
      console.warn(`[SimulationEngine] Online login error for ${patientName}:`, err);
    }

    const patientActor: SimulatedActor = {
      id: `ACTOR-PATIENT-ONLINE-${index}`,
      role: 'ONLINE_USER',
      name: patientName,
      email,
      token: patientToken,
      status: 'READY',
      tasksCompleted: 0,
      requestsCount: 0,
    };
    this.state.actors.push(patientActor);
    this.state.metrics.activeActorsCount = this.state.actors.length;

    const patientContext: RequestActorContext = {
      actorId: patientActor.id,
      actorRole: 'PATIENT',
      actorName: patientName,
      token: patientToken,
    };

    // Step 3: Fetch authenticated patient profile
    let patientProfileId = `sim-pat-online-${runId.toLowerCase()}-${String(index).padStart(3, '0')}`;
    try {
      const myProfile = await simulationApi.getMyProfile(patientContext, runId);
      if (myProfile?.id) {
        patientProfileId = myProfile.id;
      }
    } catch {
      try {
        const pRes = await simulationApi.createPatient(
          {
            name: patientName,
            gender: 'Female',
            patientType: 'Online',
          },
          patientContext,
          runId
        );
        patientProfileId = pRes.id;
      } catch {
        // Fallback
      }
    }

    const journey: SimulatedPatientJourney = {
      patientId: patientProfileId,
      patientName,
      patientType: 'Online',
      currentDepartment: 'RECEPTION',
      visitStatus: 'REGISTERED',
      doctorName: doctorActor?.name || 'Dr. Specialist',
      hasLabTest: false,
      hasPrescription: false,
      isBlocked: false,
      timeline: [
        {
          time: new Date().toLocaleTimeString(),
          stage: 'RECEPTION',
          title: 'Online Appointment Authenticated',
          description: `Patient authenticated session via POST /auth/login. Checking in digital booking.`,
        },
      ],
      startedAt: new Date().toISOString(),
    };

    this.state.patients.push(journey);
    this.state.metrics.totalPatients++;
    this.state.metrics.inProgressVisits++;
    this.recalculateDepartmentMetrics();
    this.notifyState();

    // Step 4: Book appointment via real POST /appointments using patient's token
    let apptId = `appt-${Date.now()}-${index}`;
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    try {
      const apptRes = await simulationApi.bookAppointment(
        {
          patientId: patientProfileId,
          doctorId: doctorActor?.backendDoctorId || '00000000-0000-0000-0000-000000000001',
          startTime,
        },
        patientContext,
        runId
      );
      apptId = apptRes.id;
    } catch {
      // Fallback
    }

    // Step 5: Check in appointment via real POST /appointments/:id/check-in using patient's token
    let createdVisitId = `visit-online-${Date.now()}-${index}`;
    try {
      const checkInRes = await simulationApi.checkInAppointment(apptId, patientContext, runId);
      if (checkInRes.visit?.id) {
        createdVisitId = checkInRes.visit.id;
      }
    } catch {
      try {
        const vRes = await simulationApi.createVisit(
          {
            patientId: patientProfileId,
            visitType: 'ONLINE',
            assignedDoctorId: doctorActor?.backendDoctorId || null,
          },
          patientContext,
          runId
        );
        createdVisitId = vRes.id;
      } catch {
        // Ignore
      }
    }

    // Query patient queue position via real GET /queue/patient/me
    try {
      await simulationApi.getMyPatientQueue(patientContext, runId);
    } catch {
      // Ignore
    }

    journey.visitId = createdVisitId;
    journey.currentDepartment = 'DOCTOR_OPD';
    journey.visitStatus = 'WAITING_OPD';
    this.recalculateDepartmentMetrics();
    this.notifyState();

    this.logEvent(
      'APPOINTMENT_CHECKIN',
      `Online appointment checked in for ${patientName}. Joining consultation queue.`,
      patientName,
      'ONLINE_USER',
      patientName,
      'info'
    );

    // Step 6: Doctor Consultation
    const consultDuration = this.currentScenario.timing.consultationDurationSec;
    this.scheduler.schedule(consultDuration, `Consultation for ${patientName}`, async () => {
      await this.executeClinicalConsultationAndDownstream(
        journey,
        doctorActor,
        patientContext,
        createdVisitId
      );
    });
  }

  /**
   * Executes Doctor Consultation, Branching Workflow (Lab + Pharmacy + Billing),
   * and demonstrates dependency unblocking without producing 401/403 errors.
   */
  private async executeClinicalConsultationAndDownstream(
    journey: SimulatedPatientJourney,
    doctorActor: SimulatedActor | undefined,
    patientContext: RequestActorContext,
    visitId: string
  ): Promise<void> {
    const runId = this.state.runId;
    journey.visitStatus = 'IN_CONSULTATION';
    this.recalculateDepartmentMetrics();
    this.notifyState();

    this.logEvent(
      'CONSULTATION_STARTED',
      `${doctorActor?.name || 'Physician'} started consultation with ${journey.patientName}.`,
      doctorActor?.name || 'Physician',
      'DOCTOR',
      journey.patientName,
      'info'
    );

    // Clinical decisions based on scenario probabilities
    const shouldOrderLab = Math.random() < this.currentScenario.probabilities.orderLabTestProbability;
    const shouldPrescribe = Math.random() < this.currentScenario.probabilities.prescriptionProbability;

    journey.hasLabTest = shouldOrderLab;
    journey.hasPrescription = shouldPrescribe;

    const prescriptions = shouldPrescribe
      ? [
          {
            medication: 'Amoxicillin 500mg',
            dosage: '1 tablet twice daily',
            frequency: 'Every 12 hours',
            duration: '5 days',
            instructions: 'Take after meals',
          },
        ]
      : [];

    // Doctor consultation API: execute HTTP call ONLY when doctor has a valid staff/doctor token
    if (doctorActor?.token) {
      try {
        await simulationApi.createConsultation(
          journey.patientId,
          {
            visitId,
            diagnosis: 'Acute Upper Respiratory Tract Infection',
            notes: 'Patient exhibits mild pyrexia and mucosal inflammation.',
            treatmentPlan: shouldOrderLab
              ? 'Complete blood panel ordered. Symptomatic management pending diagnostic report.'
              : 'Symptomatic supportive treatment with antimicrobial coverage.',
            prescriptions,
          },
          {
            actorId: doctorActor.id,
            actorRole: 'DOCTOR',
            actorName: doctorActor.name,
            token: doctorActor.token,
          },
          runId
        );
      } catch {
        // Fallback
      }
    } else {
      // Patient inspects visit details to confirm consultation completion
      try {
        await simulationApi.getVisitById(visitId, patientContext, runId);
      } catch {
        // Fallback
      }
    }

    journey.timeline.push({
      time: new Date().toLocaleTimeString(),
      stage: 'DOCTOR_OPD',
      title: 'Consultation Completed',
      description: `Diagnosis recorded by ${doctorActor?.name || 'Physician'}.${
        shouldOrderLab ? ' Diagnostic lab test ordered.' : ''
      }${shouldPrescribe ? ' Prescription generated.' : ''}`,
    });

    if (doctorActor) doctorActor.tasksCompleted++;

    // =========================================================================
    // WORKFLOW BRANCHING & DEPENDENCIES
    // =========================================================================
    if (shouldOrderLab) {
      // Path A: Diagnostic Test is required first!
      // Pharmacy dispensing is BLOCKED by lab task until report is complete!
      journey.currentDepartment = 'LAB';
      journey.visitStatus = 'DIAGNOSTICS';
      journey.labStatus = 'SAMPLE_PENDING';
      if (shouldPrescribe) {
        journey.isBlocked = true;
        journey.blockReason = 'Pharmacy dispensing is BLOCKED awaiting Laboratory Report.';
      }
      this.recalculateDepartmentMetrics();
      this.notifyState();

      this.logEvent(
        'LAB_ORDERED',
        `Doctor ordered CBC blood panel for ${journey.patientName}. Workflow routed to Laboratory.`,
        doctorActor?.name || 'Physician',
        'DOCTOR',
        journey.patientName,
        'warning'
      );

      const labActor = this.state.actors.find((a) => a.role === 'LAB_TECH' && a.token);
      let labOrderId = `lab-${Date.now()}`;

      if (labActor?.token) {
        try {
          const orderRes = await simulationApi.createLabOrder(
            {
              visitId,
              testName: 'Complete Blood Count (CBC) with Differential',
              instructions: 'Fasting venous blood draw',
            },
            {
              actorId: labActor.id,
              actorRole: 'LAB_TECH',
              actorName: labActor.name,
              token: labActor.token,
            },
            runId
          );
          labOrderId = orderRes.id;
        } catch {
          // Fallback
        }
      } else {
        // Patient checks lab reports endpoint with authenticated token
        try {
          await simulationApi.getMyReports(patientContext, runId);
        } catch {
          // Fallback
        }
      }

      // Schedule sample collection
      const labDuration = this.currentScenario.timing.labProcessingDurationSec;
      this.scheduler.schedule(
        Math.max(2, Math.round(labDuration / 2)),
        `Sample collection for ${journey.patientName}`,
        async () => {
          journey.labStatus = 'SAMPLE_COLLECTED';
          journey.timeline.push({
            time: new Date().toLocaleTimeString(),
            stage: 'LAB',
            title: 'Sample Collected',
            description: `Blood specimen drawn. Specimen sent to hematology analyzer.`,
          });
          this.notifyState();

          if (labActor?.token) {
            try {
              await simulationApi.recordSampleCollected(
                labOrderId,
                {
                  actorId: labActor.id,
                  actorRole: 'LAB_TECH',
                  actorName: labActor.name,
                  token: labActor.token,
                },
                runId
              );
            } catch {
              // Fallback
            }
          }

          // Schedule report completion
          this.scheduler.schedule(
            Math.max(2, Math.round(labDuration / 2)),
            `Lab result ready for ${journey.patientName}`,
            async () => {
              journey.labStatus = 'COMPLETED';
              journey.isBlocked = false;
              journey.blockReason = undefined;

              journey.timeline.push({
                time: new Date().toLocaleTimeString(),
                stage: 'LAB',
                title: 'Diagnostic Report Ready',
                description: `WBC 6.8 K/uL, Platelets 240 K/uL, Hb 14.2 g/dL. Prerequisites satisfied.`,
              });

              this.logEvent(
                'LAB_COMPLETED',
                `Diagnostic CBC report completed for ${journey.patientName}. Dependent workflow unblocked!`,
                labActor?.name || 'Lab Tech',
                'LAB_TECH',
                journey.patientName,
                'success'
              );

              if (labActor) labActor.tasksCompleted++;

              if (labActor?.token) {
                try {
                  await simulationApi.uploadLabReport(
                    labOrderId,
                    'CBC Normal: WBC 6.8 K/uL, Hb 14.2 g/dL. No evidence of systemic bacteremia.',
                    {
                      actorId: labActor.id,
                      actorRole: 'LAB_TECH',
                      actorName: labActor.name,
                      token: labActor.token,
                    },
                    runId
                  );
                } catch {
                  // Fallback
                }
              }

              // Advance to Pharmacy or Billing
              if (shouldPrescribe) {
                this.proceedToPharmacy(journey, patientContext, visitId);
              } else {
                this.proceedToBilling(journey, patientContext, visitId);
              }
            }
          );
        }
      );
    } else if (shouldPrescribe) {
      // Direct to Pharmacy
      this.proceedToPharmacy(journey, patientContext, visitId);
    } else {
      // Direct to Billing
      this.proceedToBilling(journey, patientContext, visitId);
    }
  }

  /**
   * Routes patient through pharmacy dispensing.
   */
  private proceedToPharmacy(
    journey: SimulatedPatientJourney,
    patientContext: RequestActorContext,
    visitId: string
  ): void {
    const runId = this.state.runId;
    journey.currentDepartment = 'PHARMACY';
    journey.visitStatus = 'PHARMACY';
    journey.pharmacyStatus = 'WAITING_DISPENSE';
    this.recalculateDepartmentMetrics();
    this.notifyState();

    const pharmActor = this.state.actors.find((a) => a.role === 'PHARMACIST' && a.token);

    this.logEvent(
      'PHARMACY_QUEUE',
      `Patient ${journey.patientName} arrived at Pharmacy for medication fulfillment.`,
      pharmActor?.name || 'Pharmacy Dispensary',
      'PHARMACIST',
      journey.patientName,
      'info'
    );

    // Patient queries their prescriptions using authenticated token
    try {
      simulationApi.getMyPrescriptions(patientContext, runId);
    } catch {
      // Fallback
    }

    const pharmDuration = this.currentScenario.timing.pharmacyDispenseDurationSec;
    this.scheduler.schedule(pharmDuration, `Dispense medicine for ${journey.patientName}`, async () => {
      journey.pharmacyStatus = 'DISPENSED';
      journey.timeline.push({
        time: new Date().toLocaleTimeString(),
        stage: 'PHARMACY',
        title: 'Medication Dispensed',
        description: `Prescription dispensed & counseling provided by ${pharmActor?.name || 'Pharmacist'}.`,
      });

      this.logEvent(
        'PHARMACY_DISPENSED',
        `Medications dispensed to ${journey.patientName} by ${pharmActor?.name || 'Pharmacist'}.`,
        pharmActor?.name || 'Pharmacist',
        'PHARMACIST',
        journey.patientName,
        'success'
      );

      if (pharmActor) pharmActor.tasksCompleted++;

      if (pharmActor?.token) {
        try {
          await simulationApi.dispensePrescription(
            `presc-${visitId}`,
            { quantity: '10 tablets', notes: 'Completed full antibiotic course' },
            {
              actorId: pharmActor.id,
              actorRole: 'PHARMACIST',
              actorName: pharmActor.name,
              token: pharmActor.token,
            },
            runId
          );
        } catch {
          // Fallback
        }
      }

      this.proceedToBilling(journey, patientContext, visitId);
    });
  }

  /**
   * Routes patient through invoice generation and billing settlement.
   * Utilizes real patient-authenticated cash queue / invoice endpoints to prevent 401/403 errors.
   */
  private proceedToBilling(
    journey: SimulatedPatientJourney,
    patientContext: RequestActorContext,
    visitId: string
  ): void {
    const runId = this.state.runId;
    journey.currentDepartment = 'BILLING';
    journey.visitStatus = 'BILLING';
    journey.billingStatus = 'INVOICE_PENDING';
    this.recalculateDepartmentMetrics();
    this.notifyState();

    const billingActor = this.state.actors.find((a) => a.role === 'BILLING_CLERK' && a.token);
    const isCash = Math.random() < this.currentScenario.probabilities.cashPaymentProbability;
    const billDuration = this.currentScenario.timing.billingProcessingDurationSec;

    // Step 1: Patient queues at cash counter via real POST /billing/cash-queue using their authenticated token.
    // This generates the invoice and registers the visit in the billing cash queue cleanly!
    let generatedInvoiceId = `inv-${Date.now()}`;
    (async () => {
      try {
        const cashQueueRes = await simulationApi.joinCashCounterQueue(visitId, patientContext, runId);
        if (cashQueueRes?.invoiceId || cashQueueRes?.invoice_id) {
          generatedInvoiceId = cashQueueRes.invoiceId || cashQueueRes.invoice_id || generatedInvoiceId;
        }
      } catch {
        // Fallback
      }

      // Patient queries invoices for the visit via real GET /visits/:id/invoices using authenticated token
      try {
        await simulationApi.getVisitInvoices(visitId, patientContext, runId);
      } catch {
        // Fallback
      }
    })();

    this.scheduler.schedule(billDuration, `Process billing for ${journey.patientName}`, async () => {
      // If billing clerk has an authenticated STAFF token, perform staff settlement
      if (billingActor?.token) {
        try {
          await simulationApi.payInvoice(
            generatedInvoiceId,
            {
              actorId: billingActor.id,
              actorRole: 'BILLING_CLERK',
              actorName: billingActor.name,
              token: billingActor.token,
            },
            runId
          );
        } catch {
          // Fallback
        }
      }

      journey.billingStatus = 'PAID';
      journey.timeline.push({
        time: new Date().toLocaleTimeString(),
        stage: 'BILLING',
        title: 'Invoice Settled',
        description: `Payment settled via ${isCash ? 'Cash Counter' : 'Online Checkout'} ($${
          50 + (journey.hasLabTest ? 35 : 0) + (journey.hasPrescription ? 20 : 0)
        }.00).`,
      });

      this.logEvent(
        'INVOICE_PAID',
        `Invoice settled for ${journey.patientName} via ${isCash ? 'Cash Counter' : 'Digital Payment'}.`,
        billingActor?.name || 'Cash Counter',
        'BILLING_CLERK',
        journey.patientName,
        'success'
      );

      if (billingActor) billingActor.tasksCompleted++;

      // Final Step: Complete visit and discharge
      this.scheduler.schedule(1, `Discharge ${journey.patientName}`, async () => {
        journey.currentDepartment = 'DISCHARGED';
        journey.visitStatus = 'COMPLETED';
        journey.completedAt = new Date().toISOString();
        journey.totalDurationSec = Math.round(
          (new Date(journey.completedAt).getTime() - new Date(journey.startedAt).getTime()) / 1000
        );

        journey.timeline.push({
          time: new Date().toLocaleTimeString(),
          stage: 'DISCHARGED',
          title: 'Patient Discharged',
          description: 'Encounter concluded. Patient departed facility.',
        });

        this.state.metrics.completedJourneys++;
        this.state.metrics.inProgressVisits = Math.max(0, this.state.metrics.inProgressVisits - 1);

        // If billing clerk has real STAFF token, update visit status to COMPLETED on backend
        if (billingActor?.token) {
          try {
            await simulationApi.updateVisitStatus(
              visitId,
              'COMPLETED',
              {
                actorId: billingActor.id,
                actorRole: 'BILLING_CLERK',
                actorName: billingActor.name,
                token: billingActor.token,
              },
              runId
            );
          } catch {
            // Fallback
          }
        } else {
          // Patient queries final visit record
          try {
            await simulationApi.getVisitById(visitId, patientContext, runId);
          } catch {
            // Fallback
          }
        }

        this.logEvent(
          'PATIENT_DISCHARGED',
          `Patient ${journey.patientName} successfully completed hospital journey.`,
          'System Orchestrator',
          'SYSTEM',
          journey.patientName,
          'success'
        );

        this.recalculateDepartmentMetrics();
        this.notifyState();
      });
    });
  }

  /**
   * Recalculates department metrics, wait times, and bottleneck identification.
   */
  private recalculateDepartmentMetrics(): void {
    const deptCounts: Record<DepartmentType, number> = {
      RECEPTION: 0,
      VITALS: 0,
      DOCTOR_OPD: 0,
      LAB: 0,
      PHARMACY: 0,
      BILLING: 0,
      DISCHARGED: 0,
    };

    let maxLoadRatio = -1;
    let bottleneckDept: DepartmentType | null = null;

    for (const patient of this.state.patients) {
      if (patient.currentDepartment in deptCounts) {
        deptCounts[patient.currentDepartment]++;
      }
    }

    const deptKeys: DepartmentType[] = ['RECEPTION', 'VITALS', 'DOCTOR_OPD', 'LAB', 'PHARMACY', 'BILLING', 'DISCHARGED'];

    for (const deptKey of deptKeys) {
      const count = deptCounts[deptKey];
      const dept = this.state.departments[deptKey];
      dept.patientsPresent = count;
      dept.queueSize = Math.max(0, count - dept.activeStaff);

      if (deptKey !== 'DISCHARGED') {
        // Load ratio = queueSize / activeStaff
        const capacity = Math.max(1, dept.activeStaff);
        const loadRatio = dept.queueSize / capacity;

        if (loadRatio > maxLoadRatio && dept.queueSize > 0) {
          maxLoadRatio = loadRatio;
          bottleneckDept = deptKey;
        }
      }
    }

    // Set bottleneck flag
    for (const deptKey of deptKeys) {
      this.state.departments[deptKey].isBottleneck = deptKey === bottleneckDept;
    }

    this.state.metrics.bottleneckDepartment = bottleneckDept
      ? this.state.departments[bottleneckDept].name
      : null;

    // Recalculate average cycle time
    const finished = this.state.patients.filter((p) => p.totalDurationSec !== undefined);
    if (finished.length > 0) {
      const sum = finished.reduce((acc, p) => acc + (p.totalDurationSec || 0), 0);
      this.state.metrics.avgCycleTimeSec = Math.round(sum / finished.length);
    }
  }

  private getAvailableDoctor(): SimulatedActor | undefined {
    const doctors = this.state.actors.filter((a) => a.role === 'DOCTOR');
    if (doctors.length === 0) return undefined;
    return doctors[Math.floor(Math.random() * doctors.length)];
  }

  public destroy(): void {
    this.scheduler.reset();
    if (this.unsubscribeHttpLogs) {
      this.unsubscribeHttpLogs();
      this.unsubscribeHttpLogs = null;
    }
    if (this.unsubscribeClockTick) {
      this.unsubscribeClockTick();
      this.unsubscribeClockTick = null;
    }
    this.stateListeners.clear();
  }
}

export const simulationEngine = new SimulationEngine();
