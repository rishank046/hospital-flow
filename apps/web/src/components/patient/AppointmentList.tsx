import { useState } from 'react';
import type { Appointment } from '../../types/patient.types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { Alert } from '../common/Alert';

export interface AppointmentListProps {
  appointments: Appointment[];
  loading?: boolean;
  error?: string | null;
  onCancel?: (appointmentId: string) => Promise<void> | void;
  onRetry?: () => void;
}

export function AppointmentList({
  appointments,
  loading = false,
  error = null,
  onCancel,
  onRetry,
}: AppointmentListProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'>('ALL');

  if (loading) {
    return <Spinner label="Loading appointments..." size="md" />;
  }

  if (error) {
    return (
      <Alert type="error" title="Failed to load appointments" onRetry={onRetry}>
        {error}
      </Alert>
    );
  }

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === 'ALL') return true;
    return apt.status === filter;
  });

  const handleCancel = async (id: string) => {
    if (!onCancel) return;
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }
    setCancellingId(id);
    try {
      await onCancel(id);
    } finally {
      setCancellingId(null);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="appointment-list-wrapper">
      <div className="list-filter-bar">
        <button
          type="button"
          className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          All ({appointments.length})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === 'SCHEDULED' ? 'active' : ''}`}
          onClick={() => setFilter('SCHEDULED')}
        >
          Scheduled ({appointments.filter((a) => a.status === 'SCHEDULED').length})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === 'COMPLETED' ? 'active' : ''}`}
          onClick={() => setFilter('COMPLETED')}
        >
          Completed ({appointments.filter((a) => a.status === 'COMPLETED').length})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === 'CANCELLED' ? 'active' : ''}`}
          onClick={() => setFilter('CANCELLED')}
        >
          Cancelled ({appointments.filter((a) => a.status === 'CANCELLED').length})
        </button>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="empty-data-state">
          <span className="empty-icon" aria-hidden="true">◷</span>
          <h3>No appointments found</h3>
          <p>
            {filter === 'ALL'
              ? 'You have not booked any appointments yet.'
              : `No appointments with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="appointment-cards-grid">
          {filteredAppointments.map((apt) => {
            const status = apt.status || 'SCHEDULED';
            const statusVariant =
              status === 'COMPLETED'
                ? 'success'
                : status === 'CANCELLED'
                  ? 'danger'
                  : 'primary';

            return (
              <div key={apt.id} className="appointment-card">
                <div className="apt-header">
                  <div>
                    <h4 className="apt-doctor-name">
                      {apt.doctorName || apt.doctor_name || 'Dr. Assigned Specialist'}
                    </h4>
                    <span className="apt-department">
                      {apt.doctorDepartment ||
                        apt.doctor_department ||
                        apt.doctorSpecialization ||
                        apt.doctor_specialization ||
                        'General Medicine'}
                    </span>
                  </div>
                  <Badge variant={statusVariant}>{status}</Badge>
                </div>

                <div className="apt-details">
                  <div className="apt-time-item">
                    <span className="label">Start:</span>
                    <span className="value">
                      {formatDateTime(apt.startTime || apt.start_time)}
                    </span>
                  </div>
                  <div className="apt-time-item">
                    <span className="label">End:</span>
                    <span className="value">
                      {formatDateTime(apt.endTime || apt.end_time)}
                    </span>
                  </div>
                </div>

                {status === 'SCHEDULED' && onCancel && (
                  <div className="apt-actions">
                    <Button
                      variant="danger"
                      loading={cancellingId === apt.id}
                      onClick={() => void handleCancel(apt.id)}
                    >
                      Cancel Appointment
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
