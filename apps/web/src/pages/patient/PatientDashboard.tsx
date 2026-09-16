import { useEffect, useState, type FormEvent } from 'react';
import {
  Calendar,
  UserPlus,
  Users,
  CheckCircle2,
  Pill,
  Microscope,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { patientService } from '../../services/patient.service';
import type {
  Appointment,
  Gender,
  PatientProfile,
  Prescription,
  Report,
} from '../../types/patient.types';

export function PatientDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [myPatients, setMyPatients] = useState<PatientProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTimestamp] = useState(() => Date.now());

  // Add Patient Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState<Gender>('Male');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profData, aptsData, patientsList, rxData, repData] = await Promise.all([
        patientService.getProfile().catch(() => null),
        patientService.getAppointments().catch(() => []),
        patientService.listMyPatients().catch(() => []),
        patientService.getPrescriptions().catch(() => []),
        patientService.getReports().catch(() => []),
      ]);
      if (profData) setProfile(profData);
      if (aptsData) setAppointments(aptsData);
      if (patientsList) setMyPatients(patientsList);
      if (rxData) setPrescriptions(rxData);
      if (repData) setReports(repData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      patientService.getProfile().catch(() => null),
      patientService.getAppointments().catch(() => []),
      patientService.listMyPatients().catch(() => []),
      patientService.getPrescriptions().catch(() => []),
      patientService.getReports().catch(() => []),
    ])
      .then(([profData, aptsData, patientsList, rxData, repData]) => {
        if (!isMounted) return;
        if (profData) setProfile(profData);
        if (aptsData) setAppointments(aptsData);
        if (patientsList) setMyPatients(patientsList);
        if (rxData) setPrescriptions(rxData);
        if (repData) setReports(repData);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load dashboard data.'
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreatePatient = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newName.trim()) {
      setAddError('Please enter a name for the patient profile.');
      return;
    }

    const ageNum = parseInt(newAge, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
      setAddError('Please enter a valid age between 0 and 130.');
      return;
    }

    setAddLoading(true);
    try {
      const newPatient = await patientService.createPatientProfile({
        name: newName.trim(),
        age: ageNum,
        gender: newGender,
        mobileNumber: newPhone.trim() || undefined,
        address: newAddress.trim() || undefined,
      });

      setProfile(newPatient);
      setMyPatients((prev) => [...prev, newPatient]);
      setIsAddModalOpen(false);
      setNewName('');
      setNewAge('');
      setNewPhone('');
      setNewAddress('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create patient profile.');
    } finally {
      setAddLoading(false);
    }
  };

  const nextAppointment = appointments.find(
    (a) =>
      (a.status || 'SCHEDULED') === 'SCHEDULED' &&
      new Date(a.startTime || a.start_time || '').getTime() > currentTimestamp
  );

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const patientType = profile?.patientType || profile?.patient_type || 'Online';
  const scheduledCount = appointments.filter((a) => a.status === 'SCHEDULED').length;
  const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;
  const clinicalRecordsCount = prescriptions.length + reports.length;

  return (
    <DashboardLayout
      pageTitle={`Welcome, ${profile?.name || user?.name || 'Patient'}`}
      pageSubtitle="Track your upcoming consultations, test results, and clinical milestones."
      headerAction={
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            onClick={() => setIsAddModalOpen(true)}
            icon={<UserPlus size={16} />}
          >
            Add Dependent Profile
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/user/appointments')}
          >
            + Book Consultation
          </Button>
        </div>
      }
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadData}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading care overview..." />
      ) : (
        <div className="dashboard-content-grid">
          {/* Active Patient Profile & Switcher Bar */}
          <div className="patient-profile-bar">
            <div className="patient-profile-meta">
              <Users size={20} color="#0284c7" aria-hidden="true" />
              <div>
                <span className="patient-profile-title">Active Patient Profile</span>
                <div className="patient-profile-name">
                  {profile?.name || 'Primary Profile'}
                  <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.85rem' }}>
                    ({profile?.age ? `${profile.age}y` : ''}{profile?.gender ? ` • ${profile.gender}` : ''})
                  </span>
                </div>
              </div>
            </div>

            {myPatients.length > 1 && (
              <div className="patient-switcher-group">
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Switch profile:</span>
                {myPatients.map((p) => {
                  const isActive = p.id === profile?.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfile(p)}
                      className={`patient-switch-btn ${isActive ? 'active' : ''}`}
                    >
                      {isActive && <CheckCircle2 size={13} color="#0284c7" aria-hidden="true" />}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2-Column Responsive Desktop Workstation Layout */}
          <div className="patient-desktop-layout">
            {/* Main Primary Care Column */}
            <div className="patient-column-main">
              {/* Standardized 4 KPI Summary Cards */}
              <div className="metrics-summary-row">
                <Card className="summary-stat-card">
                  <span className="stat-label">Scheduled Visits</span>
                  <strong className="stat-value">{scheduledCount}</strong>
                  <span className="stat-hint">Active upcoming consultations</span>
                </Card>

                <Card className="summary-stat-card">
                  <span className="stat-label">Completed Encounters</span>
                  <strong className="stat-value">{completedCount}</strong>
                  <span className="stat-hint">Past specialist consultations</span>
                </Card>

                <Card className="summary-stat-card">
                  <span className="stat-label">Clinical Orders</span>
                  <strong className="stat-value">{clinicalRecordsCount}</strong>
                  <span className="stat-hint">
                    {prescriptions.length} meds • {reports.length} lab tests
                  </span>
                </Card>

                {/* Categorical KPI Hierarchy Fix */}
                <Card className="summary-stat-card">
                  <span className="stat-label">Patient Pathway</span>
                  <div className="stat-badge-value">
                    <Badge variant={patientType === 'Walkin' ? 'warning' : 'primary'} size="md">
                      {patientType}
                    </Badge>
                  </div>
                  <span className="stat-hint">Registered care category</span>
                </Card>
              </div>

              {/* Next Scheduled Appointment Card */}
              <Card
                className="upcoming-visit-card"
                header={<h3 className="card-heading">Next Scheduled Consultation</h3>}
              >
                {nextAppointment ? (
                  <div className="next-apt-details">
                    <div className="next-apt-info">
                      <h4>
                        {nextAppointment.doctorName ||
                          nextAppointment.doctor_name ||
                          'Attending Specialist'}
                      </h4>
                      <p>
                        {nextAppointment.doctorDepartment ||
                          nextAppointment.doctor_department ||
                          'Hospital Outpatient Department'}
                      </p>
                      <span className="next-apt-time">
                        <Calendar
                          size={15}
                          aria-hidden="true"
                          style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '6px' }}
                        />
                        {new Date(
                          nextAppointment.startTime || nextAppointment.start_time || ''
                        ).toLocaleString([], {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <Badge variant="primary" size="md">
                      CONFIRMED
                    </Badge>
                  </div>
                ) : (
                  <EmptyState
                    icon={Calendar}
                    title="No upcoming consultations"
                    description="You have no pending consultations scheduled. Choose a physician from our hospital specialist directory."
                    action={
                      <Button
                        variant="primary"
                        onClick={() => navigate('/user/appointments')}
                      >
                        Book an Appointment
                      </Button>
                    }
                  />
                )}
              </Card>

              {/* Fast Care Pathways */}
              <div className="quick-nav-cards">
                <Card
                  className="quick-nav-card"
                  onClick={() => navigate('/user/journey')}
                >
                  <h4 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    Care Journey Timeline <ArrowRight size={16} aria-hidden="true" />
                  </h4>
                  <p>Track your stage-by-stage progression from triage to recovery.</p>
                </Card>

                <Card
                  className="quick-nav-card"
                  onClick={() => navigate('/user/records')}
                >
                  <h4 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    Medical Records & Tests <ArrowRight size={16} aria-hidden="true" />
                  </h4>
                  <p>Inspect diagnostic lab reports, clinical findings, and orders.</p>
                </Card>
              </div>
            </div>

            {/* Side Clinical Overview Column */}
            <div className="patient-column-side">
              {/* Prescriptions Preview Card */}
              <Card
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-heading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                      <Pill size={17} color="#165b53" aria-hidden="true" />
                      Active Prescriptions ({prescriptions.length})
                    </h3>
                    {prescriptions.length > 0 && (
                      <button
                        type="button"
                        className="table-link-btn"
                        onClick={() => navigate('/user/records')}
                      >
                        View all →
                      </button>
                    )}
                  </div>
                }
              >
                {prescriptions.length === 0 ? (
                  <EmptyState
                    icon={Pill}
                    title="No active medications"
                    description="Medications prescribed during doctor consultations will appear here automatically."
                  />
                ) : (
                  <div className="patient-mini-list">
                    {prescriptions.slice(0, 3).map((rx) => (
                      <div key={rx.id} className="patient-mini-card">
                        <div className="patient-mini-header">
                          <strong className="patient-mini-title">{rx.medication}</strong>
                          <Badge variant="primary" size="sm">
                            {rx.dosage}
                          </Badge>
                        </div>
                        <p className="patient-mini-sub">
                          {rx.frequency ? `Frequency: ${rx.frequency}` : ''}
                          {rx.duration ? ` • Duration: ${rx.duration}` : ''}
                        </p>
                        {rx.doctorName && (
                          <span className="cell-meta" style={{ fontSize: '11px' }}>
                            Prescribed by Dr. {rx.doctorName}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Diagnostic Reports Preview Card */}
              <Card
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-heading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                      <Microscope size={17} color="#165b53" aria-hidden="true" />
                      Diagnostic Reports ({reports.length})
                    </h3>
                    {reports.length > 0 && (
                      <button
                        type="button"
                        className="table-link-btn"
                        onClick={() => navigate('/user/records')}
                      >
                        View all →
                      </button>
                    )}
                  </div>
                }
              >
                {reports.length === 0 ? (
                  <EmptyState
                    icon={Microscope}
                    title="No diagnostic tests recorded"
                    description="Laboratory investigations and pathology findings will be listed here once ordered."
                  />
                ) : (
                  <div className="patient-mini-list">
                    {reports.slice(0, 3).map((rep) => (
                      <div key={rep.id} className="patient-mini-card">
                        <div className="patient-mini-header">
                          <strong className="patient-mini-title">{rep.testName || rep.test_name}</strong>
                          <Badge
                            variant={rep.status === 'COMPLETED' ? 'success' : 'warning'}
                            size="sm"
                          >
                            {rep.status}
                          </Badge>
                        </div>
                        {rep.result ? (
                          <p className="patient-mini-sub" style={{ color: 'var(--ink)' }}>
                            {rep.result.length > 60 ? `${rep.result.slice(0, 60)}...` : rep.result}
                          </p>
                        ) : (
                          <p className="patient-mini-sub" style={{ fontStyle: 'italic' }}>
                            Specimen processing / awaiting report
                          </p>
                        )}
                        <span className="cell-meta" style={{ fontSize: '11px' }}>
                          {rep.createdAt || rep.created_at
                            ? new Date(rep.createdAt || rep.created_at || '').toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                          {rep.doctorName ? ` • Dr. ${rep.doctorName}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Add Patient Profile Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Family or Dependent Profile"
      >
        <form onSubmit={handleCreatePatient}>
          {addError && (
            <Alert type="error" className="mb-4">
              {addError}
            </Alert>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. John Doe, Emma Smith"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <Input
              label="Age"
              type="number"
              placeholder="e.g. 28"
              value={newAge}
              onChange={(e) => setNewAge(e.target.value)}
              min="0"
              max="130"
              required
            />

            <div className="form-field">
              <label htmlFor="modal-gender" className="form-label">
                Gender
              </label>
              <select
                id="modal-gender"
                className="form-input"
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as Gender)}
                style={{ width: '100%', height: '42px', padding: '0 0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <Input
              label="Contact / Mobile Number"
              type="tel"
              placeholder="e.g. +1 555-0199 or 9876543210"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <Input
              label="Home Address"
              type="text"
              placeholder="e.g. 123 Health Ave, Suite 4"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={addLoading}
            >
              {addLoading ? 'Creating Profile...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
