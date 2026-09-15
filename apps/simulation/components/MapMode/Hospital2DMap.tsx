// Interactive 2D Hospital Floor Plan Map with Array-Style Queues
// Strictly isolated to apps/simulation/components/MapMode/

import { useState } from 'react';
import {
  UserCheck,
  HeartPulse,
  Stethoscope,
  FlaskConical,
  Pill,
  CreditCard,
  LogOut,
  AlertTriangle,
  Users,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';
import type {
  DepartmentMetrics,
  DepartmentType,
  SimulatedActor,
  SimulatedPatientJourney,
} from '../../engine/simulationTypes';
import { ArrayQueueVisualizer } from './ArrayQueueVisualizer';

interface Hospital2DMapProps {
  departments: Record<DepartmentType, DepartmentMetrics>;
  patients: SimulatedPatientJourney[];
  actors: SimulatedActor[];
  onSelectPatient: (patientId: string) => void;
}

export function Hospital2DMap({
  departments,
  patients,
  actors,
  onSelectPatient,
}: Hospital2DMapProps) {
  const [activeDepartment, setActiveDepartment] = useState<DepartmentType | null>(null);
  const [compactMode, setCompactMode] = useState(false);

  const getActorsForDepartment = (deptType: DepartmentType) => {
    switch (deptType) {
      case 'RECEPTION':
        return actors.filter((a) => a.role === 'OPD_MANAGER');
      case 'VITALS':
        return actors.filter((a) => a.role === 'NURSE' || a.role === 'OPD_MANAGER');
      case 'DOCTOR_OPD':
        return actors.filter((a) => a.role === 'DOCTOR');
      case 'LAB':
        return actors.filter((a) => a.role === 'LAB_TECH');
      case 'PHARMACY':
        return actors.filter((a) => a.role === 'PHARMACIST');
      case 'BILLING':
        return actors.filter((a) => a.role === 'BILLING_CLERK');
      default:
        return [];
    }
  };

  return (
    <div className="sim-map2d-wrapper">
      {/* Floor Plan Header & Legend */}
      <div className="sim-map2d-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="sim-blueprint-badge">
            <Layers size={14} />
            LEVEL 1 FLOOR PLAN • CLINICAL PATIENT FLOW
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--sim-text-muted)' }}>
            Dynamic CS Array Queues & Real-Time Department Routing
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="sim-map2d-legend">
            <span className="sim-legend-item">
              <span className="sim-legend-dot head" /> Head Pointer [0]
            </span>
            <span className="sim-legend-item">
              <span className="sim-legend-dot normal" /> Enqueued Patient
            </span>
            <span className="sim-legend-item">
              <span className="sim-legend-dot blocked" /> Blocked Dependency
            </span>
          </div>

          <button
            className="sim-btn sim-btn-outline"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
            onClick={() => setCompactMode(!compactMode)}
            title="Toggle Queue Array Density"
          >
            {compactMode ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            {compactMode ? 'Expand Queues' : 'Compact View'}
          </button>
        </div>
      </div>

      {/* Architectural 2D Hospital Canvas */}
      <div className="sim-map2d-canvas">
        {/* ROW 1: ENTRANCE & INTAKE ZONE */}
        <div className="sim-floor-zone entrance-zone">
          <div className="sim-zone-label">WEST ENTRANCE & REGISTRATION CORE</div>

          <div className="sim-room-grid">
            {/* Room 1: Reception Desk */}
            <div
              className={`sim-room-card ${departments.RECEPTION.isBottleneck ? 'bottleneck' : ''} ${
                activeDepartment === 'RECEPTION' ? 'focused' : ''
              }`}
              onClick={() => setActiveDepartment(activeDepartment === 'RECEPTION' ? null : 'RECEPTION')}
            >
              <div className="sim-room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <UserCheck size={18} color="#38bdf8" />
                  <div>
                    <strong className="sim-room-title">Station 101 • Reception & Intake</strong>
                    <span className="sim-room-subtitle">Walk-in Registration & Digital Check-in</span>
                  </div>
                </div>

                <div className="sim-room-meta">
                  <span className="sim-badge sim-badge-neutral">
                    <Users size={10} /> {getActorsForDepartment('RECEPTION').length || 1} Staff
                  </span>
                  {departments.RECEPTION.isBottleneck && (
                    <span className="sim-badge sim-badge-danger">
                      <AlertTriangle size={10} /> Bottleneck
                    </span>
                  )}
                </div>
              </div>

              {/* Array Queue Visualizer */}
              <ArrayQueueVisualizer
                department={departments.RECEPTION}
                patients={patients}
                onSelectPatient={onSelectPatient}
                maxSlots={compactMode ? 4 : 6}
              />
            </div>

            {/* Room 2: Vitals Screening */}
            <div
              className={`sim-room-card ${departments.VITALS.isBottleneck ? 'bottleneck' : ''} ${
                activeDepartment === 'VITALS' ? 'focused' : ''
              }`}
              onClick={() => setActiveDepartment(activeDepartment === 'VITALS' ? null : 'VITALS')}
            >
              <div className="sim-room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <HeartPulse size={18} color="#fbbf24" />
                  <div>
                    <strong className="sim-room-title">Station 102 • Vitals & Triage</strong>
                    <span className="sim-room-subtitle">Blood Pressure, Pulse, SpO2 & Temperature</span>
                  </div>
                </div>

                <div className="sim-room-meta">
                  <span className="sim-badge sim-badge-neutral">
                    <Users size={10} /> Triage Staff
                  </span>
                  {departments.VITALS.isBottleneck && (
                    <span className="sim-badge sim-badge-danger">
                      <AlertTriangle size={10} /> Bottleneck
                    </span>
                  )}
                </div>
              </div>

              {/* Array Queue Visualizer */}
              <ArrayQueueVisualizer
                department={departments.VITALS}
                patients={patients}
                onSelectPatient={onSelectPatient}
                maxSlots={compactMode ? 4 : 6}
              />
            </div>
          </div>
        </div>

        {/* TRANSIT CORRIDOR A */}
        <div className="sim-transit-corridor">
          <div className="sim-corridor-line" />
          <span className="sim-corridor-label">CENTRAL CLINICAL CORRIDOR • ROUTING PATIENTS TO OPD & SPECIALIST SUITES</span>
          <div className="sim-corridor-line" />
        </div>

        {/* ROW 2: CLINICAL CONSULTATION WING */}
        <div className="sim-floor-zone clinical-zone">
          <div className="sim-zone-label">NORTH WING • PHYSICIAN CONSULTATION SUITES</div>

          <div className="sim-room-grid">
            {/* Room 3: Doctor Consultation Suites */}
            <div
              className={`sim-room-card doctor-suite ${departments.DOCTOR_OPD.isBottleneck ? 'bottleneck' : ''} ${
                activeDepartment === 'DOCTOR_OPD' ? 'focused' : ''
              }`}
              onClick={() => setActiveDepartment(activeDepartment === 'DOCTOR_OPD' ? null : 'DOCTOR_OPD')}
            >
              <div className="sim-room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Stethoscope size={18} color="#34d399" />
                  <div>
                    <strong className="sim-room-title">Suite 201 • OPD Consultation Chambers</strong>
                    <span className="sim-room-subtitle">Clinical Evaluation, Diagnosis & Downstream Orders</span>
                  </div>
                </div>

                <div className="sim-room-meta">
                  <span className="sim-badge sim-badge-success">
                    <Users size={10} /> {getActorsForDepartment('DOCTOR_OPD').length || 2} Doctors Active
                  </span>
                  {departments.DOCTOR_OPD.isBottleneck && (
                    <span className="sim-badge sim-badge-danger">
                      <AlertTriangle size={10} /> Overload
                    </span>
                  )}
                </div>
              </div>

              {/* Doctor Roster Chips */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {getActorsForDepartment('DOCTOR_OPD').map((doc) => (
                  <div key={doc.id} className="sim-doctor-desk-badge">
                    <span className="sim-desk-indicator" />
                    <strong>{doc.name}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--sim-text-muted)' }}>
                      ({doc.specialization || 'General'})
                    </span>
                  </div>
                ))}
              </div>

              {/* Array Queue Visualizer */}
              <ArrayQueueVisualizer
                department={departments.DOCTOR_OPD}
                patients={patients}
                onSelectPatient={onSelectPatient}
                maxSlots={compactMode ? 5 : 8}
              />
            </div>
          </div>
        </div>

        {/* TRANSIT CORRIDOR B: DIAGNOSTICS & PHARMACY */}
        <div className="sim-transit-corridor">
          <div className="sim-corridor-line" />
          <span className="sim-corridor-label">DOWNSTREAM WORKFLOW BRANCHING • LAB ORDERS ⇄ PHARMACY FULFILLMENT</span>
          <div className="sim-corridor-line" />
        </div>

        {/* ROW 3: DIAGNOSTICS & DISPENSARY WING */}
        <div className="sim-floor-zone service-zone">
          <div className="sim-zone-label">EAST WING • ANCILLARY CLINICAL SERVICES</div>

          <div className="sim-room-grid">
            {/* Room 4: Laboratory */}
            <div
              className={`sim-room-card ${departments.LAB.isBottleneck ? 'bottleneck' : ''} ${
                activeDepartment === 'LAB' ? 'focused' : ''
              }`}
              onClick={() => setActiveDepartment(activeDepartment === 'LAB' ? null : 'LAB')}
            >
              <div className="sim-room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FlaskConical size={18} color="#a855f7" />
                  <div>
                    <strong className="sim-room-title">Lab 301 • Diagnostics & Pathology</strong>
                    <span className="sim-room-subtitle">Phlebotomy, Specimen Processing & Result Entry</span>
                  </div>
                </div>

                <div className="sim-room-meta">
                  <span className="sim-badge sim-badge-purple">
                    <Users size={10} /> {getActorsForDepartment('LAB').length || 1} Techs
                  </span>
                  {departments.LAB.isBottleneck && (
                    <span className="sim-badge sim-badge-danger">
                      <AlertTriangle size={10} /> Backlog
                    </span>
                  )}
                </div>
              </div>

              {/* Array Queue Visualizer */}
              <ArrayQueueVisualizer
                department={departments.LAB}
                patients={patients}
                onSelectPatient={onSelectPatient}
                maxSlots={compactMode ? 4 : 6}
              />
            </div>

            {/* Room 5: Pharmacy */}
            <div
              className={`sim-room-card ${departments.PHARMACY.isBottleneck ? 'bottleneck' : ''} ${
                activeDepartment === 'PHARMACY' ? 'focused' : ''
              }`}
              onClick={() => setActiveDepartment(activeDepartment === 'PHARMACY' ? null : 'PHARMACY')}
            >
              <div className="sim-room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Pill size={18} color="#f472b6" />
                  <div>
                    <strong className="sim-room-title">Dispensary 302 • Hospital Pharmacy</strong>
                    <span className="sim-room-subtitle">Verification, Dispensing & Patient Counseling</span>
                  </div>
                </div>

                <div className="sim-room-meta">
                  <span className="sim-badge sim-badge-neutral">
                    <Users size={10} /> {getActorsForDepartment('PHARMACY').length || 1} Pharmacist
                  </span>
                  {departments.PHARMACY.isBottleneck && (
                    <span className="sim-badge sim-badge-danger">
                      <AlertTriangle size={10} /> Dispense Queue Full
                    </span>
                  )}
                </div>
              </div>

              {/* Array Queue Visualizer */}
              <ArrayQueueVisualizer
                department={departments.PHARMACY}
                patients={patients}
                onSelectPatient={onSelectPatient}
                maxSlots={compactMode ? 4 : 6}
              />
            </div>
          </div>
        </div>

        {/* TRANSIT CORRIDOR C: BILLING & EXIT */}
        <div className="sim-transit-corridor">
          <div className="sim-corridor-line" />
          <span className="sim-corridor-label">FINANCIAL SETTLEMENT & DISCHARGE DISPATCH</span>
          <div className="sim-corridor-line" />
        </div>

        {/* ROW 4: ACCOUNTS & DISCHARGE */}
        <div className="sim-floor-zone exit-zone">
          <div className="sim-zone-label">SOUTH WING • ACCOUNTS & DISCHARGE LOUNGE</div>

          <div className="sim-room-grid">
            {/* Room 6: Billing & Cash Counter */}
            <div
              className={`sim-room-card ${departments.BILLING.isBottleneck ? 'bottleneck' : ''} ${
                activeDepartment === 'BILLING' ? 'focused' : ''
              }`}
              onClick={() => setActiveDepartment(activeDepartment === 'BILLING' ? null : 'BILLING')}
            >
              <div className="sim-room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CreditCard size={18} color="#38bdf8" />
                  <div>
                    <strong className="sim-room-title">Counter 401 • Cash & Billing Settlement</strong>
                    <span className="sim-room-subtitle">Invoice Review, Cash Collection & Receipts</span>
                  </div>
                </div>

                <div className="sim-room-meta">
                  <span className="sim-badge sim-badge-info">
                    <Users size={10} /> {getActorsForDepartment('BILLING').length || 1} Cashier
                  </span>
                  {departments.BILLING.isBottleneck && (
                    <span className="sim-badge sim-badge-danger">
                      <AlertTriangle size={10} /> Cash Queue Busy
                    </span>
                  )}
                </div>
              </div>

              {/* Array Queue Visualizer */}
              <ArrayQueueVisualizer
                department={departments.BILLING}
                patients={patients}
                onSelectPatient={onSelectPatient}
                maxSlots={compactMode ? 4 : 6}
              />
            </div>

            {/* Room 7: Discharged Lounge */}
            <div
              className={`sim-room-card ${activeDepartment === 'DISCHARGED' ? 'focused' : ''}`}
              onClick={() => setActiveDepartment(activeDepartment === 'DISCHARGED' ? null : 'DISCHARGED')}
            >
              <div className="sim-room-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <LogOut size={18} color="#34d399" />
                  <div>
                    <strong className="sim-room-title">Zone 402 • Completed & Discharged</strong>
                    <span className="sim-room-subtitle">Encounter Concluded • Patient Departed</span>
                  </div>
                </div>

                <div className="sim-room-meta">
                  <span className="sim-badge sim-badge-success">
                    {patients.filter((p) => p.currentDepartment === 'DISCHARGED').length} Discharged
                  </span>
                </div>
              </div>

              {/* Array Queue Visualizer */}
              <ArrayQueueVisualizer
                department={departments.DISCHARGED}
                patients={patients}
                onSelectPatient={onSelectPatient}
                maxSlots={compactMode ? 4 : 6}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
