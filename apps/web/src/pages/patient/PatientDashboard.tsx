import { useEffect, useState, type FormEvent } from 'react';
import { Calendar, UserPlus, Users, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { patientService } from '../../services/patient.service';
import type { Appointment, Gender, PatientProfile } from '../../types/patient.types';

export function PatientDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [myPatients, setMyPatients] = useState<PatientProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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
      const [profData, aptsData, patientsList] = await Promise.all([
        patientService.getProfile().catch(() => null),
        patientService.getAppointments().catch(() => []),
        patientService.listMyPatients().catch(() => []),
      ]);
      if (profData) setProfile(profData);
      if (aptsData) setAppointments(aptsData);
      if (patientsList) setMyPatients(patientsList);
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
    ])
      .then(([profData, aptsData, patientsList]) => {
        if (!isMounted) return;
        if (profData) setProfile(profData);
        if (aptsData) setAppointments(aptsData);
        if (patientsList) setMyPatients(patientsList);
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

  return (
    <DashboardLayout
      pageTitle={`Welcome, ${profile?.name || user?.name || 'Patient'}`}
      pageSubtitle="Track your upcoming consultations, test results, and clinical milestones."
      headerAction={
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button
            variant="outline"
            onClick={() => setIsAddModalOpen(true)}
          >
            <UserPlus size={16} style={{ marginRight: '6px' }} />
            Add Patient Profile
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
          {/* Managed Patients Selector Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Users size={20} color="#0284c7" />
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 600 }}>
                  Active Patient Profile
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                  {profile?.name || 'Primary Profile'}{' '}
                  <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.85rem' }}>
                    ({profile?.age ? `${profile.age}y` : ''}{profile?.gender ? ` • ${profile.gender}` : ''})
                  </span>
                </div>
              </div>
            </div>

            {myPatients.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Switch profile:</span>
                {myPatients.map((p) => {
                  const isActive = p.id === profile?.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfile(p)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        borderRadius: '0.375rem',
                        border: isActive ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: isActive ? '#e0f2fe' : '#ffffff',
                        color: isActive ? '#0369a1' : '#334155',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {isActive && <CheckCircle2 size={12} color="#0284c7" />}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="metrics-summary-row">
            <Card className="summary-stat-card">
              <span className="stat-label">Scheduled Visits</span>
              <strong className="stat-value">
                {appointments.filter((a) => a.status === 'SCHEDULED').length}
              </strong>
              <span className="stat-hint">Active upcoming appointments</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Patient Type</span>
              <strong className="stat-value">
                {profile?.patientType || profile?.patient_type || 'Online'}
              </strong>
              <span className="stat-hint">Registered care pathway</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Completed Consultations</span>
              <strong className="stat-value">
                {appointments.filter((a) => a.status === 'COMPLETED').length}
              </strong>
              <span className="stat-hint">Past specialist encounters</span>
            </Card>
          </div>

          <div className="dashboard-main-section">
            <Card
              className="upcoming-visit-card"
              header={<h3 className="card-heading">Next Scheduled Appointment</h3>}
            >
              {nextAppointment ? (
                <div className="next-apt-details">
                  <div className="next-apt-info">
                    <h4>
                      {nextAppointment.doctorName ||
                        nextAppointment.doctor_name ||
                        'Specialist Physician'}
                    </h4>
                    <p>
                      {nextAppointment.doctorDepartment ||
                        nextAppointment.doctor_department ||
                        'Hospital Outpatient Department'}
                    </p>
                    <span className="next-apt-time">
                      <Calendar
                        size={16}
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
                <div className="empty-next-apt">
                  <p>You have no pending consultations scheduled today.</p>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/user/appointments')}
                  >
                    Schedule an Appointment
                  </Button>
                </div>
              )}
            </Card>

            <div className="quick-nav-cards">
              <Card
                className="quick-nav-card"
                onClick={() => navigate('/user/journey')}
              >
                <h4>Care Journey Timeline <span>→</span></h4>
                <p>View step-by-step progress from triage to recovery.</p>
              </Card>

              <Card
                className="quick-nav-card"
                onClick={() => navigate('/user/records')}
              >
                <h4>Prescriptions & Diagnostics <span>→</span></h4>
                <p>Access doctor prescriptions and laboratory orders.</p>
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
