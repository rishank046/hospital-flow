import type { Prescription } from '../../types/patient.types';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';

export interface PrescriptionCardProps {
  prescription: Prescription;
}

export function PrescriptionCard({ prescription }: PrescriptionCardProps) {
  const formattedDate = prescription.createdAt || prescription.created_at
    ? new Date(
        prescription.createdAt || prescription.created_at || ''
      ).toLocaleDateString([], {
        dateStyle: 'medium',
      })
    : undefined;

  return (
    <Card
      className="prescription-card"
      header={
        <div className="prescription-header">
          <div className="medication-title-wrap">
            <span className="medication-icon" aria-hidden="true">💊</span>
            <h4 className="medication-name">{prescription.medication}</h4>
          </div>
          <Badge variant="primary" size="sm">
            {prescription.dosage}
          </Badge>
        </div>
      }
      footer={
        <div className="prescription-footer-meta">
          <span>Prescribed by: {prescription.doctorName || 'Attending Physician'}</span>
          {formattedDate && <span>Date: {formattedDate}</span>}
        </div>
      }
    >
      <div className="prescription-body-grid">
        {prescription.frequency && (
          <div className="rx-detail-row">
            <span className="rx-label">Frequency:</span>
            <span className="rx-val">{prescription.frequency}</span>
          </div>
        )}
        {prescription.duration && (
          <div className="rx-detail-row">
            <span className="rx-label">Duration:</span>
            <span className="rx-val">{prescription.duration}</span>
          </div>
        )}
        {prescription.instructions && (
          <div className="rx-detail-row full-width">
            <span className="rx-label">Instructions:</span>
            <p className="rx-instructions">{prescription.instructions}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
