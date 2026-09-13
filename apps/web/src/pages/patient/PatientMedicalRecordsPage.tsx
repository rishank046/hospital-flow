import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { PrescriptionCard } from '../../components/patient/PrescriptionCard';
import { ReportViewer } from '../../components/patient/ReportViewer';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { patientService } from '../../services/patient.service';
import type {
  Consultation,
  Prescription,
  Report,
} from '../../types/patient.types';

type RecordTab = 'prescriptions' | 'consultations' | 'reports';

export function PatientMedicalRecordsPage() {
  const [activeTab, setActiveTab] = useState<RecordTab>('prescriptions');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rxData, consultData, reportData] = await Promise.all([
        patientService.getPrescriptions().catch(() => []),
        patientService.getConsultations().catch(() => []),
        patientService.getReports().catch(() => []),
      ]);
      setPrescriptions(rxData);
      setConsultations(consultData);
      setReports(reportData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load medical records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      patientService.getPrescriptions().catch(() => []),
      patientService.getConsultations().catch(() => []),
      patientService.getReports().catch(() => []),
    ])
      .then(([rxData, consultData, reportData]) => {
        if (!isMounted) return;
        setPrescriptions(rxData);
        setConsultations(consultData);
        setReports(reportData);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load medical records.'
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

  return (
    <DashboardLayout
      pageTitle="Medical Records"
      pageSubtitle="Browse your past clinical consultations, prescribed medications, and laboratory results."
    >
      <div className="records-tab-bar">
        <button
          type="button"
          className={`tab-item-btn ${activeTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          Prescriptions ({prescriptions.length})
        </button>
        <button
          type="button"
          className={`tab-item-btn ${activeTab === 'consultations' ? 'active' : ''}`}
          onClick={() => setActiveTab('consultations')}
        >
          Past Consultations ({consultations.length})
        </button>
        <button
          type="button"
          className={`tab-item-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Lab Reports ({reports.length})
        </button>
      </div>

      {error && (
        <Alert type="error" className="mb-4" onRetry={loadRecords}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading clinical files..." />
      ) : (
        <div className="records-tab-body">
          {activeTab === 'prescriptions' && (
            <div className="prescriptions-tab-content">
              {prescriptions.length === 0 ? (
                <div className="empty-data-state">
                  <span className="empty-icon" aria-hidden="true">Rx</span>
                  <h3>No prescriptions on record</h3>
                  <p>Medications prescribed during doctor consultations will appear here.</p>
                </div>
              ) : (
                <div className="prescriptions-grid">
                  {prescriptions.map((rx) => (
                    <PrescriptionCard key={rx.id} prescription={rx} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'consultations' && (
            <div className="consultations-tab-content">
              {consultations.length === 0 ? (
                <div className="empty-data-state">
                  <span className="empty-icon" aria-hidden="true">≡</span>
                  <h3>No consultations on record</h3>
                  <p>Summaries and clinical notes from your physicians will be stored here.</p>
                </div>
              ) : (
                <div className="consultations-grid">
                  {consultations.map((c) => (
                    <Card
                      key={c.id}
                      header={
                        <div className="consult-header">
                          <h4>{c.diagnosis}</h4>
                          <span className="text-muted">
                            {c.createdAt || c.created_at
                              ? new Date(c.createdAt || c.created_at || '').toLocaleDateString()
                              : 'Past visit'}
                          </span>
                        </div>
                      }
                      footer={
                        (c.doctorName || c.doctor_name) && (
                          <span className="text-muted text-sm">
                            Attending: Dr. {c.doctorName || c.doctor_name}
                          </span>
                        )
                      }
                    >
                      {c.notes && (
                        <div className="consult-row">
                          <strong>Notes:</strong>
                          <p>{c.notes}</p>
                        </div>
                      )}
                      {(c.treatmentPlan || c.treatment_plan) && (
                        <div className="consult-row">
                          <strong>Treatment Plan:</strong>
                          <p>{c.treatmentPlan || c.treatment_plan}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <ReportViewer reports={reports} loading={false} error={null} />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
