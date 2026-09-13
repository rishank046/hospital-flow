import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { ScheduleView } from '../../components/doctor/ScheduleView';
import { useDoctorSchedule } from '../../hooks/useDoctorSchedule';
import { Button } from '../../components/common/Button';

export function DoctorSchedulePage() {
  const { schedule, loading, error, fetchSchedule } = useDoctorSchedule(true);

  const navigate = (patientId: string) => {
    window.history.pushState({}, '', `/doctor/patients/${patientId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <DashboardLayout
      pageTitle="Daily Schedule"
      pageSubtitle="Review all consultations and patient visits assigned to your clinical schedule."
      headerAction={
        <Button variant="outline" onClick={fetchSchedule} disabled={loading}>
          ↻ Refresh Schedule
        </Button>
      }
    >
      <ScheduleView
        schedule={schedule}
        loading={loading}
        error={error}
        onConsult={navigate}
        onRetry={fetchSchedule}
      />
    </DashboardLayout>
  );
}
