import { useEffect, useState } from 'react';
import {
  Heart,
  Search,
  Users,
  Calendar,
  Filter,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { adminService } from '../../services/admin.service';
import type { AdminPatient } from '../../types/admin.types';

export function AdminPatientsPage() {
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getPatients();
      setPatients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve patient registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    adminService
      .getPatients()
      .then((data) => {
        if (mounted) {
          setPatients(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve patient registry.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const patientTypes = Array.from(
    new Set(patients.map((p) => p.patient_type).filter(Boolean))
  );

  const filteredPatients = patients.filter((patient) => {
    if (typeFilter !== 'ALL' && patient.patient_type !== typeFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = patient.name.toLowerCase().includes(q);
      const emailMatch = (patient.owner_email || '').toLowerCase().includes(q);
      const typeMatch = (patient.patient_type || '').toLowerCase().includes(q);
      return nameMatch || emailMatch || typeMatch;
    }

    return true;
  });

  return (
    <DashboardLayout
      pageTitle="Patient Profiles Registry"
      pageSubtitle="Hospital Patient Records • Read-Only Administrative Audit"
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadPatients}>
          {error}
        </Alert>
      )}

      {/* Filter Bar */}
      <Card className="mb-6">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ minWidth: '260px', flex: 1 }}>
            <Input
              placeholder="Search patients by name, account owner email, or intake type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by patient intake type"
            >
              <option value="ALL">All Intake Types</option>
              {patientTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Patient Table */}
      {loading ? (
        <Spinner label="Loading patient registry..." />
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Registered Patient Profiles ({filteredPatients.length})
            </h3>
            <span className="text-secondary text-sm">
              Showing {filteredPatients.length} of {patients.length} records
            </span>
          </div>

          {filteredPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Filter size={36} className="text-secondary" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p className="text-secondary">No patients match the specified criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <th style={{ padding: '0.75rem' }}>Patient Name</th>
                    <th style={{ padding: '0.75rem' }}>Demographics</th>
                    <th style={{ padding: '0.75rem' }}>Intake Mode</th>
                    <th style={{ padding: '0.75rem' }}>Managing Account Email</th>
                    <th style={{ padding: '0.75rem' }}>Registered Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Heart size={16} style={{ color: 'var(--primary-color, #0d9488)' }} />
                          <strong style={{ fontSize: '0.95rem' }}>{patient.name}</strong>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span>
                          {patient.age ? `${patient.age} yrs` : 'N/A'}, {patient.gender || 'Unknown'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <Badge
                          variant={
                            patient.patient_type === 'Emergency' || patient.patient_type === 'EMERGENCY'
                              ? 'danger'
                              : patient.patient_type === 'Online'
                              ? 'primary'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {patient.patient_type || 'STANDARD'}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Users size={14} className="text-secondary" />
                          <span className="text-secondary text-sm">{patient.owner_email || 'Direct / System'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} className="text-secondary" />
                          <span className="text-secondary text-sm">
                            {new Date(patient.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </DashboardLayout>
  );
}
