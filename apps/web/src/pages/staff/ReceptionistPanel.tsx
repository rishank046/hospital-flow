import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  UserCheck,
  UserPlus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { staffService } from '../../services/staff.service';
import type {
  DoctorSummary,
  PatientSummary,
  VisitItem,
  VisitStatus,
} from '../../types/staff.types';

export function ReceptionistPanel() {
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Registration Mode
  const [registrationMode, setRegistrationMode] = useState<'walkin' | 'existing'>('walkin');

  // Walk-in Patient Form State
  const [walkinName, setWalkinName] = useState('');
  const [walkinAge, setWalkinAge] = useState('');
  const [walkinGender, setWalkinGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [visitType, setVisitType] = useState('WALKIN');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');

  // Existing Patient Check-in State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Visit status filter & search
  const [visitStatusFilter, setVisitStatusFilter] = useState<string>('ALL');
  const [visitSearch, setVisitSearch] = useState('');
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const [visitsData, patientsData, doctorsData] = await Promise.all([
        staffService.getVisits(),
        staffService.getPatients().catch(() => []),
        staffService.getDoctors().catch(() => []),
      ]);
      setVisits(visitsData);
      setPatients(patientsData);
      setDoctors(doctorsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visits data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      staffService.getVisits(),
      staffService.getPatients().catch(() => []),
      staffService.getDoctors().catch(() => []),
    ])
      .then(([visitsData, patientsData, doctorsData]) => {
        if (mounted) {
          setVisits(visitsData);
          setPatients(patientsData);
          setDoctors(doctorsData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load visits data.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleWalkinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!walkinName.trim()) {
      setFormError('Patient full name is required.');
      return;
    }
    const ageNum = parseInt(walkinAge, 10);
    if (isNaN(ageNum) || ageNum < 0) {
      setFormError('Please enter a valid age.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      // 1. Create walk-in patient profile
      const newPatient = await staffService.createPatient({
        name: walkinName.trim(),
        age: ageNum,
        gender: walkinGender,
        patientType: 'Walkin',
      });

      // 2. Create visit record
      const newVisit = await staffService.createVisit({
        patientId: newPatient.id,
        visitType: visitType || 'WALKIN',
        assignedDoctorId: assignedDoctorId || null,
      });

      setSuccessMessage(
        `Successfully registered walk-in visit for ${newPatient.name} (Visit ID: ${newVisit.id.slice(0, 8)}).`
      );

      // Reset form
      setWalkinName('');
      setWalkinAge('');
      setWalkinGender('Male');
      setVisitType('WALKIN');
      setAssignedDoctorId('');

      // Reload visits
      const updatedVisits = await staffService.getVisits();
      setVisits(updatedVisits);
      const updatedPatients = await staffService.getPatients().catch(() => []);
      setPatients(updatedPatients);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to register walk-in patient.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExistingCheckIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setFormError('Please select a patient to check in.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const newVisit = await staffService.createVisit({
        patientId: selectedPatientId,
        visitType: visitType || 'WALKIN',
        assignedDoctorId: assignedDoctorId || null,
      });

      const pat = patients.find((p) => p.id === selectedPatientId);
      setSuccessMessage(
        `Checked in ${pat?.name || 'patient'} successfully (Visit ID: ${newVisit.id.slice(0, 8)}).`
      );

      setSelectedPatientId('');
      setPatientSearch('');
      setVisitType('WALKIN');
      setAssignedDoctorId('');

      const updatedVisits = await staffService.getVisits();
      setVisits(updatedVisits);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to check in patient.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToVitals = async (visitId: string) => {
    setTransitioningId(visitId);
    setActionError(null);
    try {
      await staffService.updateVisitStatus(visitId, 'VITALS');
      const updated = await staffService.getVisits();
      setVisits(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to advance visit to vitals.');
    } finally {
      setTransitioningId(null);
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch.trim()) return true;
    const query = patientSearch.toLowerCase();
    return p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query);
  });

  const filteredVisits = visits.filter((v) => {
    if (visitStatusFilter !== 'ALL' && v.status !== visitStatusFilter) {
      return false;
    }
    if (visitSearch.trim()) {
      const q = visitSearch.toLowerCase();
      const patientMatch = (v.patient_name || '').toLowerCase().includes(q);
      const doctorMatch = (v.doctor_name || '').toLowerCase().includes(q);
      const idMatch = v.id.toLowerCase().includes(q);
      return patientMatch || doctorMatch || idMatch;
    }
    return true;
  });

  const getStatusBadgeVariant = (status: VisitStatus) => {
    switch (status) {
      case 'REGISTERED':
        return 'primary';
      case 'VITALS':
        return 'warning';
      case 'WAITING_OPD':
        return 'warning';
      case 'IN_CONSULTATION':
        return 'primary';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const awaitingVitalsCount = visits.filter((v) => v.status === 'REGISTERED').length;
  const activeCareCount = visits.filter((v) => v.status !== 'COMPLETED' && v.status !== 'CANCELLED').length;
  const completedCount = visits.filter((v) => v.status === 'COMPLETED').length;

  return (
    <div className="receptionist-panel">
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadData}>
          {error}
        </Alert>
      )}

      {actionError && (
        <Alert type="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* Workspace Header */}
      <div className="station-header">
        <div className="station-header-info">
          <h3>
            <UserCheck size={20} aria-hidden="true" />
            Reception & Outpatient Intake
          </h3>
          <p>Register walk-in arrivals, verify active encounters, and route patients to clinical triage</p>
        </div>

        <div className="station-header-actions">
          <Button
            variant={registrationMode === 'walkin' ? 'primary' : 'outline'}
            onClick={() => {
              setRegistrationMode('walkin');
              setFormError(null);
              setSuccessMessage(null);
            }}
            icon={<UserPlus size={16} />}
          >
            New Walk-in
          </Button>
          <Button
            variant={registrationMode === 'existing' ? 'primary' : 'outline'}
            onClick={() => {
              setRegistrationMode('existing');
              setFormError(null);
              setSuccessMessage(null);
            }}
            icon={<UserCheck size={16} />}
          >
            Existing Patient
          </Button>
          <Button
            variant="outline"
            onClick={loadData}
            loading={loading}
            icon={<RefreshCw size={16} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Workload Summary (Section 12) */}
      <div className="metrics-summary-row mb-6">
        <Card className="summary-stat-card">
          <span className="stat-label">Awaiting Vitals</span>
          <strong className="stat-value">{awaitingVitalsCount}</strong>
          <span className="stat-hint">Patients queued for triage station</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Active Care Stream</span>
          <strong className="stat-value">{activeCareCount}</strong>
          <span className="stat-hint">Visits currently in progress</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Completed Visits</span>
          <strong className="stat-value">{completedCount}</strong>
          <span className="stat-hint">Encounters finished today</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Total Registered</span>
          <strong className="stat-value">{visits.length}</strong>
          <span className="stat-hint">Total OPD intake records today</span>
        </Card>
      </div>

      {/* Primary Queue / Data Area */}
      <Card className="mb-6">
        <div className="station-header" style={{ marginBottom: '14px' }}>
          <div className="station-header-info">
            <h3 style={{ fontSize: '18px' }}>
              Patient Visits Directory ({filteredVisits.length})
            </h3>
            <p>Live register of patient encounters and status progression</p>
          </div>
        </div>

        {/* Filter / Search Controls */}
        <div className="station-filter-bar">
          <div className="station-search-box">
            <Input
              placeholder="Search visits by patient, doctor, or ID..."
              value={visitSearch}
              onChange={(e) => setVisitSearch(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <select
            className="station-filter-select"
            value={visitStatusFilter}
            onChange={(e) => setVisitStatusFilter(e.target.value)}
            aria-label="Filter visits by status"
          >
            <option value="ALL">All Visit Statuses ({visits.length})</option>
            <option value="REGISTERED">REGISTERED</option>
            <option value="VITALS">VITALS</option>
            <option value="WAITING_OPD">WAITING_OPD</option>
            <option value="IN_CONSULTATION">IN_CONSULTATION</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        {loading ? (
          <Spinner label="Loading visits queue..." />
        ) : filteredVisits.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No visits found"
            description="No patient visits match your search criteria. Register a walk-in patient or check in an existing patient below."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visit ID</th>
                  <th>Patient Name</th>
                  <th>Visit Type</th>
                  <th>Assigned Doctor</th>
                  <th>Status</th>
                  <th>Registered At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisits.map((v) => (
                  <tr key={v.id}>
                    <td className="cell-id">{v.id.slice(0, 8)}</td>
                    <td className="cell-name">{v.patient_name || 'Patient'}</td>
                    <td>
                      <Badge variant="neutral" size="sm">
                        {v.visit_type}
                      </Badge>
                    </td>
                    <td className="cell-meta">
                      {v.doctor_name ? `Dr. ${v.doctor_name}` : 'Unassigned'}
                    </td>
                    <td>
                      <Badge variant={getStatusBadgeVariant(v.status)} size="sm">
                        {v.status}
                      </Badge>
                    </td>
                    <td className="cell-meta">
                      {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="cell-actions">
                      {v.status === 'REGISTERED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSendToVitals(v.id)}
                          loading={transitioningId === v.id}
                          icon={<ArrowRight size={14} />}
                        >
                          Send to Vitals
                        </Button>
                      )}
                      {v.status === 'VITALS' && (
                        <span className="text-secondary text-xs">Awaiting Vitals</span>
                      )}
                      {v.status !== 'REGISTERED' && v.status !== 'VITALS' && (
                        <span className="text-secondary text-xs">In Care Stream</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Secondary Operational Context: Intake & Registration */}
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <h3 className="section-title" style={{ margin: '0 0 4px', fontSize: '18px' }}>
            {registrationMode === 'walkin' ? 'Register New Walk-in Patient' : 'Check In Registered Patient'}
          </h3>
          <p className="text-secondary text-sm" style={{ margin: 0 }}>
            {registrationMode === 'walkin'
              ? 'Create a temporary walk-in patient profile and queue them for triage'
              : 'Search the existing patient directory and create a new visit encounter'}
          </p>
        </div>

        {formError && (
          <Alert type="error" className="mb-4" onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}

        {successMessage && (
          <Alert type="success" className="mb-4" onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {registrationMode === 'walkin' ? (
          <form onSubmit={handleWalkinSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <Input
                label="Full Patient Name *"
                placeholder="e.g. John Doe"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                required
              />

              <Input
                label="Age *"
                type="number"
                min="0"
                max="130"
                placeholder="e.g. 34"
                value={walkinAge}
                onChange={(e) => setWalkinAge(e.target.value)}
                required
              />

              <div className="form-field">
                <label className="form-label">Gender</label>
                <select
                  className="form-input"
                  value={walkinGender}
                  onChange={(e) => setWalkinGender(e.target.value as 'Male' | 'Female' | 'Other')}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Visit Type</label>
                <select
                  className="form-input"
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}
                >
                  <option value="WALKIN">Walk-in (WALKIN)</option>
                  <option value="OPD">OPD Consultation</option>
                  <option value="EMERGENCY">Emergency</option>
                  <option value="ROUTINE">Routine Checkup</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Assigned Doctor (Optional)</label>
                <select
                  className="form-input"
                  value={assignedDoctorId}
                  onChange={(e) => setAssignedDoctorId(e.target.value)}
                >
                  <option value="">-- Any Available Doctor --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.name} {doc.specialization ? `(${doc.specialization})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" loading={submitting} icon={<CheckCircle2 size={16} />}>
                Register & Check In Walk-in
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleExistingCheckIn}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-field">
                <label className="form-label">Select Patient *</label>
                <div style={{ marginBottom: '0.5rem' }}>
                  <Input
                    placeholder="Search by patient name..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    leftIcon={<Search size={16} />}
                  />
                </div>
                <select
                  className="form-input"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Registered Patient ({filteredPatients.length}) --</option>
                  {filteredPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.age ? `(Age ${p.age})` : ''} - ID: {p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Visit Type</label>
                <select
                  className="form-input"
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}
                >
                  <option value="WALKIN">Walk-in</option>
                  <option value="OPD">OPD Consultation</option>
                  <option value="EMERGENCY">Emergency</option>
                  <option value="ROUTINE">Routine Follow-up</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Assigned Doctor (Optional)</label>
                <select
                  className="form-input"
                  value={assignedDoctorId}
                  onChange={(e) => setAssignedDoctorId(e.target.value)}
                >
                  <option value="">-- Any Available Doctor --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.name} {doc.specialization ? `(${doc.specialization})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                loading={submitting}
                disabled={!selectedPatientId}
                icon={<CheckCircle2 size={16} />}
              >
                Create Visit & Check In
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
