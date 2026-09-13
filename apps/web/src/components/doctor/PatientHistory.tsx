import type { Consultation } from '../../types/patient.types';
import type { InvestigationOrder } from '../../types/doctor.types';
import { Spinner } from '../common/Spinner';
import { Alert } from '../common/Alert';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';

export interface PatientHistoryProps {
  consultations: Consultation[];
  orders?: InvestigationOrder[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PatientHistory({
  consultations,
  orders = [],
  loading = false,
  error = null,
  onRetry,
}: PatientHistoryProps) {
  if (loading) {
    return <Spinner label="Loading clinical history..." size="md" />;
  }

  if (error) {
    return (
      <Alert type="error" title="Failed to load history" onRetry={onRetry}>
        {error}
      </Alert>
    );
  }

  if (consultations.length === 0 && orders.length === 0) {
    return (
      <div className="empty-data-state">
        <span className="empty-icon" aria-hidden="true">📋</span>
        <h3>No past medical history recorded</h3>
        <p>This patient has no previous consultations or investigation orders recorded.</p>
      </div>
    );
  }

  return (
    <div className="patient-history-container">
      <div className="history-section">
        <h3 className="section-heading">Past Consultations & Diagnoses</h3>
        {consultations.length === 0 ? (
          <p className="text-muted">No prior consultations recorded.</p>
        ) : (
          <div className="consultations-list">
            {consultations.map((c) => {
              const dateStr = c.createdAt || c.created_at;
              return (
                <Card
                  key={c.id}
                  className="consultation-history-card"
                  header={
                    <div className="consultation-card-header">
                      <div>
                        <h4 className="diagnosis-title">{c.diagnosis}</h4>
                        <span className="consultation-meta-date">
                          {dateStr
                            ? new Date(dateStr).toLocaleDateString([], {
                                dateStyle: 'long',
                              })
                            : 'Past Consultation'}
                        </span>
                      </div>
                      {c.doctorName && (
                        <span className="doctor-badge">Dr. {c.doctorName}</span>
                      )}
                    </div>
                  }
                >
                  {c.notes && (
                    <div className="history-detail-block">
                      <strong className="block-label">Clinical Notes:</strong>
                      <p>{c.notes}</p>
                    </div>
                  )}

                  {(c.treatmentPlan || c.treatment_plan) && (
                    <div className="history-detail-block">
                      <strong className="block-label">Treatment Plan:</strong>
                      <p>{c.treatmentPlan || c.treatment_plan}</p>
                    </div>
                  )}

                  {c.prescriptions && c.prescriptions.length > 0 && (
                    <div className="history-rx-block">
                      <strong className="block-label">Issued Prescriptions:</strong>
                      <ul className="rx-list">
                        {c.prescriptions.map((rx) => (
                          <li key={rx.id} className="rx-item">
                            <span className="rx-name">
                              {rx.medication} ({rx.dosage})
                            </span>
                            {rx.frequency && (
                              <span className="rx-freq"> - {rx.frequency}</span>
                            )}
                            {rx.instructions && (
                              <span className="rx-inst"> ({rx.instructions})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="history-section mt-6">
          <h3 className="section-heading">Lab & Diagnostic Orders</h3>
          <div className="orders-list">
            {orders.map((o) => (
              <div key={o.id} className="order-history-item">
                <div className="order-item-header">
                  <strong>{o.testName || o.test_name}</strong>
                  <Badge
                    variant={o.status === 'COMPLETED' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {o.status}
                  </Badge>
                </div>
                {o.instructions && (
                  <p className="order-instructions">Instructions: {o.instructions}</p>
                )}
                {o.result && <p className="order-result">Result: {o.result}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
