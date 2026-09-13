import type { ScheduleItem } from '../../types/doctor.types';
import { Spinner } from '../common/Spinner';
import { Alert } from '../common/Alert';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export interface ScheduleViewProps {
  schedule: ScheduleItem[];
  loading?: boolean;
  error?: string | null;
  onConsult?: (patientId: string) => void;
  onRetry?: () => void;
}

export function ScheduleView({
  schedule,
  loading = false,
  error = null,
  onConsult,
  onRetry,
}: ScheduleViewProps) {
  if (loading) {
    return <Spinner label="Loading daily schedule..." size="md" />;
  }

  if (error) {
    return (
      <Alert type="error" title="Failed to load schedule" onRetry={onRetry}>
        {error}
      </Alert>
    );
  }

  if (!schedule || schedule.length === 0) {
    return (
      <div className="empty-data-state">
        <span className="empty-icon" aria-hidden="true">◷</span>
        <h3>No appointments scheduled</h3>
        <p>You have no scheduled patient consultations for this day.</p>
      </div>
    );
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '—';
    try {
      return new Date(timeStr).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="schedule-table-wrapper">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Time Slot</th>
            <th>Patient ID / Name</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((item) => {
            const patientId = item.patientId || item.patient_id;
            const startTime = item.startTime || item.start_time;
            const endTime = item.endTime || item.end_time;
            const isCompleted = item.status === 'COMPLETED';

            return (
              <tr key={item.id}>
                <td className="time-slot-cell">
                  <strong>{formatTime(startTime)}</strong> - {formatTime(endTime)}
                </td>
                <td className="patient-cell">
                  <span className="patient-name">
                    {item.patientName || item.patient_name || 'Patient'}
                  </span>
                  <span className="patient-sub-id">{patientId}</span>
                </td>
                <td>
                  <Badge
                    variant={
                      isCompleted
                        ? 'success'
                        : item.status === 'CANCELLED'
                          ? 'danger'
                          : 'primary'
                    }
                    size="sm"
                  >
                    {item.status}
                  </Badge>
                </td>
                <td>
                  <div className="action-cell">
                    <a
                      href={`/doctor/patients/${patientId}`}
                      className="table-link-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        window.history.pushState({}, '', `/doctor/patients/${patientId}`);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                    >
                      View Chart
                    </a>
                    {onConsult && patientId && !isCompleted && item.status !== 'CANCELLED' && (
                      <Button
                        variant="primary"
                        onClick={() => onConsult(patientId)}
                        className="btn-sm"
                      >
                        Consult
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
