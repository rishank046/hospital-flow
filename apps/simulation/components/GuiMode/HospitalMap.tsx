// Schematic Hospital Floor Map & Department Nodes
// Strictly isolated to apps/web/src/simulation/components/GuiMode/

import {
  UserCheck,
  HeartPulse,
  Stethoscope,
  FlaskConical,
  Pill,
  CreditCard,
  LogOut,
  AlertCircle,
  Users,
} from 'lucide-react';
import type {
  DepartmentMetrics,
  DepartmentType,
  SimulatedPatientJourney,
} from '../../engine/simulationTypes';

interface HospitalMapProps {
  departments: Record<DepartmentType, DepartmentMetrics>;
  patients: SimulatedPatientJourney[];
  selectedDepartment: DepartmentType | null;
  onSelectDepartment: (dept: DepartmentType | null) => void;
  onSelectPatient: (patientId: string) => void;
}

export function HospitalMap({
  departments,
  patients,
  selectedDepartment,
  onSelectDepartment,
  onSelectPatient,
}: HospitalMapProps) {
  const getDepartmentIcon = (type: DepartmentType) => {
    switch (type) {
      case 'RECEPTION':
        return <UserCheck size={18} color="#38bdf8" />;
      case 'VITALS':
        return <HeartPulse size={18} color="#fbbf24" />;
      case 'DOCTOR_OPD':
        return <Stethoscope size={18} color="#34d399" />;
      case 'LAB':
        return <FlaskConical size={18} color="#a855f7" />;
      case 'PHARMACY':
        return <Pill size={18} color="#f472b6" />;
      case 'BILLING':
        return <CreditCard size={18} color="#38bdf8" />;
      case 'DISCHARGED':
        return <LogOut size={18} color="#94a3b8" />;
    }
  };

  const departmentOrder: DepartmentType[] = [
    'RECEPTION',
    'VITALS',
    'DOCTOR_OPD',
    'LAB',
    'PHARMACY',
    'BILLING',
    'DISCHARGED',
  ];

  return (
    <div className="sim-hospital-map-container">
      <div className="sim-map-header">
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
            Hospital Operational Flow Map
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sim-text-muted)' }}>
            Real-time visual schematic of patients moving through clinical stations.
          </p>
        </div>

        {selectedDepartment && (
          <button
            className="sim-btn sim-btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
            onClick={() => onSelectDepartment(null)}
          >
            Clear Filter (Show All)
          </button>
        )}
      </div>

      <div className="sim-map-grid">
        {departmentOrder.map((deptKey) => {
          const dept = departments[deptKey];
          const deptPatients = patients.filter((p) => p.currentDepartment === deptKey);
          const isSelected = selectedDepartment === deptKey;

          return (
            <div
              key={deptKey}
              className={`sim-dept-card ${dept.isBottleneck ? 'bottleneck' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectDepartment(isSelected ? null : deptKey)}
            >
              <div className="sim-dept-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  {getDepartmentIcon(deptKey)}
                  <h4 className="sim-dept-title">{dept.name}</h4>
                </div>
                {dept.isBottleneck && (
                  <span className="sim-badge sim-badge-danger" title="Station queue exceeds processing capacity">
                    <AlertCircle size={10} />
                    Bottleneck
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>
                  {deptPatients.length}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--sim-text-muted)' }}>
                  patients present
                </span>
              </div>

              <div className="sim-dept-stats">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Users size={12} />
                  Staff: {dept.activeStaff}
                </span>
                <span>
                  Queue: <strong style={{ color: dept.queueSize > 0 ? '#fbbf24' : 'inherit' }}>{dept.queueSize}</strong>
                </span>
              </div>

              {/* Patient Chips */}
              {deptPatients.length > 0 && (
                <div className="sim-patient-chips">
                  {deptPatients.slice(0, 6).map((p) => (
                    <button
                      key={p.patientId}
                      className={`sim-patient-chip ${p.isBlocked ? 'blocked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPatient(p.patientId);
                      }}
                      title={p.isBlocked ? `BLOCKED: ${p.blockReason}` : `${p.patientName} (${p.visitStatus})`}
                    >
                      {p.isBlocked && '⚠ '}
                      {p.patientName.split(' ')[0]}
                    </button>
                  ))}
                  {deptPatients.length > 6 && (
                    <span className="sim-patient-chip" style={{ backgroundColor: '#1e293b' }}>
                      +{deptPatients.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
