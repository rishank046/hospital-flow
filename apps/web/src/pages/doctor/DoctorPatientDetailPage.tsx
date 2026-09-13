import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { PatientHistory } from '../../components/doctor/PatientHistory';
import { ConsultationModal } from '../../components/doctor/ConsultationModal';
import { OrderLabTestModal } from '../../components/doctor/OrderLabTestModal';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { doctorService } from '../../services/doctor.service';
import type {
  CreateConsultationPayload,
  CreateInvestigationOrderPayload,
  DoctorPatientDetail,
} from '../../types/doctor.types';

export interface DoctorPatientDetailPageProps {
  patientId: string;
}

export function DoctorPatientDetailPage({ patientId }: DoctorPatientDetailPageProps) {
  const [detail, setDetail] = useState<DoctorPatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isConsultOpen, setIsConsultOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  const loadPatientDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await doctorService.getPatientDetail(patientId);
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load patient records.'
      );
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    let isMounted = true;
    doctorService
      .getPatientDetail(patientId)
      .then((data) => {
        if (isMounted) setDetail(data);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load patient records.'
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [patientId]);

  const handleCreateConsultation = async (payload: CreateConsultationPayload) => {
    await doctorService.createConsultation(patientId, payload);
    await loadPatientDetail();
  };

  const handleOrderLab = async (payload: CreateInvestigationOrderPayload) => {
    await doctorService.orderLabTest(patientId, payload);
    await loadPatientDetail();
  };

  return (
    <DashboardLayout
      pageTitle={detail?.patient?.name ? `Patient Chart: ${detail.patient.name}` : 'Patient Chart'}
      pageSubtitle={`UUID: ${patientId}`}
      headerAction={
        <div className="header-action-group">
          <Button variant="outline" onClick={() => setIsOrderOpen(true)}>
            + Order Lab Test
          </Button>
          <Button variant="primary" onClick={() => setIsConsultOpen(true)}>
            + Record Consultation
          </Button>
        </div>
      }
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadPatientDetail}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading clinical chart..." />
      ) : detail ? (
        <div className="patient-chart-layout">
          <Card className="patient-demographics-card">
            <div className="demographics-grid">
              <div>
                <span className="demo-label">Full Name</span>
                <strong>{detail.patient.name}</strong>
              </div>
              <div>
                <span className="demo-label">Age / Gender</span>
                <strong>
                  {detail.patient.age || 'N/A'} yrs • {detail.patient.gender || 'Other'}
                </strong>
              </div>
              <div>
                <span className="demo-label">Patient Type</span>
                <Badge variant="primary" size="sm">
                  {detail.patient.patientType || detail.patient.patient_type || 'Online'}
                </Badge>
              </div>
              <div>
                <span className="demo-label">Email</span>
                <span>{detail.patient.email || 'None on file'}</span>
              </div>
            </div>
          </Card>

          <PatientHistory
            consultations={detail.consultations || []}
            orders={detail.orders || []}
            loading={false}
            error={null}
          />
        </div>
      ) : (
        <div className="empty-data-state">
          <p>Patient could not be found or loaded.</p>
        </div>
      )}

      <ConsultationModal
        isOpen={isConsultOpen}
        onClose={() => setIsConsultOpen(false)}
        patientId={patientId}
        onSubmit={handleCreateConsultation}
      />

      <OrderLabTestModal
        isOpen={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
        patientId={patientId}
        onSubmit={handleOrderLab}
      />
    </DashboardLayout>
  );
}
