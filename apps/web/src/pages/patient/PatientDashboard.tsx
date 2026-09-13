import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { patientService } from '../../services/patient.service';
import type { Appointment, PatientProfile } from '../../types/patient.types';

export function PatientDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profData, aptsData] = await Promise.all([
        patientService.getProfile().catch(() => null),
        patientService.getAppointments().catch(() => []),
      ]);
      if (profData) setProfile(profData);
      if (aptsData) setAppointments(aptsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const nextAppointment = appointments.find(
    (a) => a.status === 'SCHEDULED' && new Date(a.startTime || a.start_time || '').getTime() > Date.now()
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
        <Button
          variant="primary"
          onClick={() => navigate('/patient/appointments')}
        >
          + Book Consultation
        </Button>
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
                    onClick={() => navigate('/patient/appointments')}
                  >
                    Schedule an Appointment
                  </Button>
                </div>
              )}
            </Card>

            <div className="quick-nav-cards">
              <Card
                className="quick-nav-card"
                onClick={() => navigate('/patient/journey')}
              >
                <h4>Care Journey Timeline <span>→</span></h4>
                <p>View step-by-step progress from triage to recovery.</p>
              </Card>

              <Card
                className="quick-nav-card"
                onClick={() => navigate('/patient/records')}
              >
                <h4>Prescriptions & Diagnostics <span>→</span></h4>
                <p>Access doctor prescriptions and laboratory orders.</p>
              </Card>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
