import { Activity } from 'lucide-react';
import type { JourneyEvent } from '../../types/patient.types';
import { Spinner } from '../common/Spinner';
import { Alert } from '../common/Alert';
import { Badge } from '../common/Badge';

export interface JourneyTimelineProps {
  events: JourneyEvent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function JourneyTimeline({
  events,
  loading = false,
  error = null,
  onRetry,
}: JourneyTimelineProps) {
  if (loading) {
    return <Spinner label="Loading journey events..." size="md" />;
  }

  if (error) {
    return (
      <Alert type="error" title="Failed to load timeline" onRetry={onRetry}>
        {error}
      </Alert>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="empty-data-state">
        <span className="empty-icon" aria-hidden="true">
          <Activity size={36} color="var(--muted)" aria-hidden="true" />
        </span>
        <h3>No journey milestones yet</h3>
        <p>
          Your care journey milestones, consultations, and test updates will appear
          here in real-time as care progresses.
        </p>
      </div>
    );
  }

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="timeline-container">
      <div className="timeline-track">
        {sortedEvents.map((evt, idx) => {
          const isLatest = idx === 0;
          return (
            <div
              key={evt.id || idx}
              className={`timeline-item ${isLatest ? 'timeline-latest' : ''}`}
            >
              <div className="timeline-node">
                <span className="timeline-bullet" />
              </div>

              <div className="timeline-card">
                <div className="timeline-header">
                  <span className="timeline-title">{evt.title}</span>
                  {evt.status && (
                    <Badge
                      variant={
                        evt.status.toLowerCase().includes('complete')
                          ? 'success'
                          : 'primary'
                      }
                      size="sm"
                    >
                      {evt.status}
                    </Badge>
                  )}
                </div>

                {evt.description && (
                  <p className="timeline-desc">{evt.description}</p>
                )}

                <div className="timeline-meta">
                  <span>{new Date(evt.timestamp).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}</span>
                  {evt.type && <span className="timeline-tag">{evt.type}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
