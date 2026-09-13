import type { Report } from '../../types/patient.types';
import { Spinner } from '../common/Spinner';
import { Alert } from '../common/Alert';
import { Badge } from '../common/Badge';
import { Card } from '../common/Card';

export interface ReportViewerProps {
  reports: Report[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function ReportViewer({
  reports,
  loading = false,
  error = null,
  onRetry,
}: ReportViewerProps) {
  if (loading) {
    return <Spinner label="Loading investigation reports..." size="md" />;
  }

  if (error) {
    return (
      <Alert type="error" title="Failed to load lab reports" onRetry={onRetry}>
        {error}
      </Alert>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="empty-data-state">
        <span className="empty-icon" aria-hidden="true">🔬</span>
        <h3>No lab reports available</h3>
        <p>Your lab investigations, test orders, and results will appear here.</p>
      </div>
    );
  }

  return (
    <div className="reports-grid">
      {reports.map((report) => {
        const isCompleted = report.status === 'COMPLETED';
        const dateStr = report.createdAt || report.created_at;

        return (
          <Card
            key={report.id}
            className="report-card"
            header={
              <div className="report-card-header">
                <h4 className="report-title">{report.testName || report.test_name}</h4>
                <Badge variant={isCompleted ? 'success' : 'warning'} size="sm">
                  {report.status}
                </Badge>
              </div>
            }
            footer={
              <div className="report-card-footer">
                <span>
                  Ordered: {dateStr ? new Date(dateStr).toLocaleDateString() : 'Recent'}
                </span>
                {report.doctorName && <span>Ordered by: {report.doctorName}</span>}
              </div>
            }
          >
            {report.instructions && (
              <div className="report-section">
                <span className="section-label">Instructions:</span>
                <p className="section-text">{report.instructions}</p>
              </div>
            )}

            <div className="report-section">
              <span className="section-label">Findings / Result:</span>
              <div className={`report-result-box ${!isCompleted ? 'pending-box' : ''}`}>
                {report.result ? (
                  <p>{report.result}</p>
                ) : (
                  <p className="text-muted">Investigation pending sample collection or processing.</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
