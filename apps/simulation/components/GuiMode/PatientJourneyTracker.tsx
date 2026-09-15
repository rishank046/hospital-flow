// Live Patient Journey Tracker & Clinical Dependency Inspector
// Strictly isolated to apps/web/src/simulation/components/GuiMode/

import { useState } from 'react';
import {
  User,
  AlertTriangle,
  FlaskConical,
  Pill,
  CreditCard,
} from 'lucide-react';
import type {
  DepartmentType,
  SimulatedPatientJourney,
} from '../../engine/simulationTypes';

interface PatientJourneyTrackerProps {
  patients: SimulatedPatientJourney[];
  selectedPatientId: string | null;
  onSelectPatient: (patientId: string) => void;
  departmentFilter: DepartmentType | null;
}

export function PatientJourneyTracker({
  patients,
  selectedPatientId,
  onSelectPatient,
  departmentFilter,
}: PatientJourneyTrackerProps) {
  const [search, setSearch] = useState('');

  const filteredPatients = patients.filter((p) => {
    if (departmentFilter && p.currentDepartment !== departmentFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.patientName.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedPatient =
    patients.find((p) => p.patientId === selectedPatientId) ||
    filteredPatients[0] ||
    patients[0];

  return (
    <div className="sim-journey-section">
      {/* Left Patient List */}
      <div className="sim-patient-list">
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#ffffff' }}>
            Patient Encounters ({filteredPatients.length})
          </h4>
          <input
            type="text"
            className="sim-input"
            style={{ width: '100%' }}
            placeholder="Search patient or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredPatients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--sim-text-muted)', fontSize: '0.85rem' }}>
            No patients found matching filter.
          </div>
        ) : (
          filteredPatients.map((pat) => {
            const isSelected = selectedPatient?.patientId === pat.patientId;
            return (
              <div
                key={pat.patientId}
                className={`sim-patient-item ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectPatient(pat.patientId)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{pat.patientName}</strong>
                  <span className="sim-badge sim-badge-neutral">{pat.patientType}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--sim-text-muted)' }}>
                  <span>Station: {pat.currentDepartment}</span>
                  {pat.isBlocked ? (
                    <span style={{ color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <AlertTriangle size={12} />
                      BLOCKED
                    </span>
                  ) : pat.visitStatus === 'COMPLETED' ? (
                    <span style={{ color: '#34d399', fontWeight: 600 }}>DISCHARGED</span>
                  ) : (
                    <span style={{ color: '#38bdf8' }}>{pat.visitStatus}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right Journey Inspector */}
      <div>
        {selectedPatient ? (
          <div>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <User size={20} color="var(--sim-primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff' }}>
                    {selectedPatient.patientName}
                  </h3>
                  <span className="sim-badge sim-badge-info">{selectedPatient.patientType}</span>
                  {selectedPatient.visitStatus === 'COMPLETED' && (
                    <span className="sim-badge sim-badge-success">COMPLETED</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sim-text-muted)' }}>
                  Assigned Physician: <strong style={{ color: '#e2e8f0' }}>{selectedPatient.doctorName || 'General OPD'}</strong> • Visit ID: <code>{selectedPatient.visitId?.slice(0, 10) || 'Pending'}</code>
                </p>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--sim-text-muted)' }}>
                <div>Started: {new Date(selectedPatient.startedAt).toLocaleTimeString()}</div>
                {selectedPatient.totalDurationSec !== undefined && (
                  <div style={{ color: '#34d399', fontWeight: 600 }}>
                    Duration: {selectedPatient.totalDurationSec}s
                  </div>
                )}
              </div>
            </div>

            {/* Workflow Dependency & Blocker Alert */}
            {selectedPatient.isBlocked && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', padding: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fca5a5' }}>
                <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Workflow Dependency Enforced:</strong> {selectedPatient.blockReason}
                  <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '0.2rem' }}>
                    Backend rule: Downstream pharmacy task remains BLOCKED until laboratory task is COMPLETED.
                  </div>
                </div>
              </div>
            )}

            {/* Clinical Task Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#0f172a', border: '1px solid var(--sim-card-border)', borderRadius: '6px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', color: '#a855f7', fontSize: '0.85rem', fontWeight: 600 }}>
                  <FlaskConical size={16} />
                  Diagnostics (Lab)
                </div>
                <div style={{ fontSize: '0.8rem', color: varTextColor(selectedPatient.labStatus) }}>
                  {selectedPatient.hasLabTest
                    ? `Status: ${selectedPatient.labStatus || 'ORDERED'}`
                    : 'No diagnostic test ordered'}
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', border: '1px solid var(--sim-card-border)', borderRadius: '6px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', color: '#f472b6', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Pill size={16} />
                  Prescriptions
                </div>
                <div style={{ fontSize: '0.8rem', color: varTextColor(selectedPatient.pharmacyStatus) }}>
                  {selectedPatient.hasPrescription
                    ? `Status: ${selectedPatient.pharmacyStatus || 'PENDING'}`
                    : 'No medication prescribed'}
                </div>
              </div>

              <div style={{ backgroundColor: '#0f172a', border: '1px solid var(--sim-card-border)', borderRadius: '6px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}>
                  <CreditCard size={16} />
                  Billing & Settlement
                </div>
                <div style={{ fontSize: '0.8rem', color: varTextColor(selectedPatient.billingStatus) }}>
                  {selectedPatient.billingStatus ? `Status: ${selectedPatient.billingStatus}` : 'Pending consult'}
                </div>
              </div>
            </div>

            {/* Step-by-Step Chronological Journey Timeline */}
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#ffffff' }}>
              Encounter Progress Timeline
            </h4>
            <div className="sim-timeline">
              {selectedPatient.timeline.map((step, idx) => (
                <div key={idx} className="sim-timeline-item">
                  <div className={`sim-timeline-dot ${step.isBlocker ? 'blocker' : ''}`} />
                  <div className="sim-timeline-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{step.title}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--sim-text-muted)' }}>{step.time}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--sim-text-muted)' }}>
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--sim-text-muted)' }}>
            Select a patient on the left or from the hospital map to inspect their clinical journey.
          </div>
        )}
      </div>
    </div>
  );
}

function varTextColor(status?: string): string {
  if (!status) return 'var(--sim-text-muted)';
  if (status === 'COMPLETED' || status === 'DISPENSED' || status === 'PAID') return '#34d399';
  if (status.includes('PENDING') || status.includes('WAITING')) return '#fbbf24';
  return '#38bdf8';
}
