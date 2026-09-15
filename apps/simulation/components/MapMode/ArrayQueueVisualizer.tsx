// Computer Science Array-Style Queue Visualizer
// Strictly isolated to apps/simulation/components/MapMode/

import { AlertTriangle, Hash, ShieldAlert } from 'lucide-react';
import type { DepartmentMetrics, SimulatedPatientJourney } from '../../engine/simulationTypes';

interface ArrayQueueVisualizerProps {
  department: DepartmentMetrics;
  patients: SimulatedPatientJourney[];
  onSelectPatient?: (patientId: string) => void;
  maxSlots?: number;
}

export function ArrayQueueVisualizer({
  department,
  patients,
  onSelectPatient,
  maxSlots = 6,
}: ArrayQueueVisualizerProps) {
  const queuePatients = patients.filter((p) => p.currentDepartment === department.id);
  const slots = Array.from({ length: Math.max(maxSlots, queuePatients.length) });

  return (
    <div className="sim-array-queue-wrapper">
      <div className="sim-array-queue-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="sim-array-code-tag">Array&lt;PatientEntry&gt;</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--sim-text-muted)', fontFamily: 'monospace' }}>
            length: {queuePatients.length} | capacity: {slots.length}
          </span>
        </div>

        {department.isBottleneck && (
          <span className="sim-badge sim-badge-danger" style={{ fontSize: '0.7rem' }}>
            <ShieldAlert size={10} />
            BACKLOG OVERFLOW
          </span>
        )}
      </div>

      <div className="sim-array-cells-container">
        {slots.map((_, idx) => {
          const patient = queuePatients[idx];
          const isHead = idx === 0 && Boolean(patient);
          const isTail = idx === queuePatients.length - 1 && Boolean(patient);

          if (!patient) {
            return (
              <div key={idx} className="sim-array-slot empty">
                <span className="sim-array-index">[{idx}]</span>
                <div className="sim-slot-empty-label">
                  <span>EMPTY</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>NULL</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={patient.patientId}
              className={`sim-array-slot occupied ${patient.isBlocked ? 'blocked' : ''} ${isHead ? 'head' : ''}`}
              onClick={() => onSelectPatient?.(patient.patientId)}
              title={patient.isBlocked ? `BLOCKED: ${patient.blockReason}` : `Click to inspect ${patient.patientName}`}
            >
              {/* Index pointer header */}
              <div className="sim-slot-top-bar">
                <span className="sim-array-index">[{idx}]</span>
                {isHead && <span className="sim-pointer-badge head">HEAD</span>}
                {isTail && !isHead && <span className="sim-pointer-badge tail">TAIL</span>}
              </div>

              {/* Patient payload */}
              <div className="sim-slot-patient-info">
                <div className="sim-slot-patient-name" title={patient.patientName}>
                  {patient.patientName}
                </div>
                <div className="sim-slot-subtext">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Hash size={10} />
                    {patient.patientId.slice(-4)}
                  </span>
                  <span className={`sim-badge ${patient.isBlocked ? 'sim-badge-danger' : 'sim-badge-info'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                    {patient.isBlocked ? 'BLOCKED' : patient.visitStatus}
                  </span>
                </div>
              </div>

              {/* Blocker alert warning */}
              {patient.isBlocked && (
                <div className="sim-slot-blocker-indicator">
                  <AlertTriangle size={11} />
                  <span>Prereq Pending</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
