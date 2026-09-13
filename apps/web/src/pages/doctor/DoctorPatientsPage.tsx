import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { doctorService } from '../../services/doctor.service';
import type { DoctorPatientItem } from '../../types/doctor.types';

export function DoctorPatientsPage() {
  const [patients, setPatients] = useState<DoctorPatientItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await doctorService.getPatients();
      setPatients(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load assigned patients.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    doctorService
      .getPatients()
      .then((data) => {
        if (isMounted) setPatients(data);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load assigned patients.'
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

  const filtered = patients.filter((p) => {
    const query = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.email && p.email.toLowerCase().includes(query)) ||
      p.id.toLowerCase().includes(query)
    );
  });

  const viewPatient = (id: string) => {
    window.history.pushState({}, '', `/doctor/patients/${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <DashboardLayout
      pageTitle="Assigned Patients"
      pageSubtitle="Browse patient rosters, consult history, and clinical records."
    >
      <div className="patient-search-bar">
        <Input
          placeholder="Search patients by name, email, or UUID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} color="var(--muted)" aria-hidden="true" />}
        />
      </div>

      {error && (
        <Alert type="error" className="mb-4" onRetry={fetchPatients}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading assigned patient roster..." />
      ) : filtered.length === 0 ? (
        <div className="empty-data-state">
          <span className="empty-icon" aria-hidden="true">
            <Users size={36} color="var(--muted)" aria-hidden="true" />
          </span>
          <h3>No patients found</h3>
          <p>
            {search
              ? `No patients matching "${search}".`
              : 'You have no assigned patients in your clinical roster yet.'}
          </p>
        </div>
      ) : (
        <div className="patients-grid">
          {filtered.map((patient) => (
            <div key={patient.id} className="patient-roster-card">
              <div className="patient-card-top">
                <div>
                  <h4 className="patient-card-name">{patient.name}</h4>
                  <span className="patient-card-meta">
                    {patient.gender || 'Unknown'} • {patient.age ? `${patient.age} yrs` : 'Age N/A'}
                  </span>
                </div>
                <Badge
                  variant={
                    (patient.patientType || patient.patient_type) === 'Online'
                      ? 'primary'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {patient.patientType || patient.patient_type || 'Online'}
                </Badge>
              </div>

              <div className="patient-card-body">
                <span className="patient-id-label">ID: {patient.id}</span>
                {patient.email && <span className="patient-email">{patient.email}</span>}
              </div>

              <div className="patient-card-footer">
                <button
                  type="button"
                  className="open-chart-btn"
                  onClick={() => viewPatient(patient.id)}
                >
                  Open Medical Chart <span>→</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
