import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { doctorService } from '../../services/doctor.service';
import { ScheduleView } from '../../components/doctor/ScheduleView';
import type { DoctorPatientItem, DoctorProfile, ScheduleItem } from '../../types/doctor.types';

export function DoctorDashboard() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [patients, setPatients] = useState<DoctorPatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDoctorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profData, schedData, patData] = await Promise.all([
        doctorService.getProfile().catch(() => null),
        doctorService.getSchedule().catch(() => []),
        doctorService.getPatients().catch(() => []),
      ]);
      if (profData) setProfile(profData);
      if (schedData) setSchedule(schedData);
      if (patData) setPatients(patData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load doctor dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      doctorService.getProfile().catch(() => null),
      doctorService.getSchedule().catch(() => []),
      doctorService.getPatients().catch(() => []),
    ])
      .then(([profData, schedData, patData]) => {
        if (!isMounted) return;
        if (profData) setProfile(profData);
        if (schedData) setSchedule(schedData);
        if (patData) setPatients(patData);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load doctor dashboard.'
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

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const pendingAppointments = schedule.filter((s) => s.status === 'SCHEDULED');

  return (
    <DashboardLayout
      pageTitle={`Doctor Portal: Dr. ${profile?.name || 'Physician'}`}
      pageSubtitle={`${profile?.department || 'Clinical Department'} • ${profile?.specialization || 'Specialist'}`}
      headerAction={
        <Button variant="primary" onClick={() => navigate('/doctor/schedule')}>
          View Full Schedule
        </Button>
      }
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadDoctorData}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading clinical portal..." />
      ) : (
        <div className="dashboard-content-grid">
          <div className="metrics-summary-row">
            <Card className="summary-stat-card">
              <span className="stat-label">Pending Today</span>
              <strong className="stat-value">{pendingAppointments.length}</strong>
              <span className="stat-hint">Remaining patient consultations</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Completed Consults</span>
              <strong className="stat-value">
                {schedule.filter((s) => s.status === 'COMPLETED').length}
              </strong>
              <span className="stat-hint">Concluded consultations today</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Assigned Patients</span>
              <strong className="stat-value">{patients.length}</strong>
              <span className="stat-hint">Active patient roster</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Department</span>
              <div className="stat-badge-value">
                <Badge variant="primary" size="md">
                  {profile?.department || 'General Practice'}
                </Badge>
              </div>
              <span className="stat-hint">{profile?.specialization || 'Attending Physician'}</span>
            </Card>
          </div>

          <div className="dashboard-main-section">
            <h3 className="section-title">Today's Appointment Schedule</h3>
            <ScheduleView
              schedule={schedule}
              loading={false}
              error={null}
              onConsult={(patientId) => navigate(`/doctor/patients/${patientId}`)}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
