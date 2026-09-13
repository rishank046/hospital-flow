import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { staffService } from '../../services/staff.service';
import type { StaffProfile } from '../../types/staff.types';

export function StaffPortalPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await staffService.getProfile();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const staffRoleDisplay = profile?.staff_role || user?.staffRole || 'STAFF';
  const employeeCode = profile?.employee_code || user?.employeeCode || 'PENDING';
  const department = profile?.department || user?.department || 'General Operations';

  return (
    <DashboardLayout
      pageTitle={`Staff Portal: ${profile?.name || user?.name || 'Staff Member'}`}
      pageSubtitle={`Hospital Operations • Role: ${staffRoleDisplay}`}
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadProfile}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading staff profile..." />
      ) : (
        <div className="dashboard-content-grid">
          <div className="metrics-summary-row">
            <Card className="summary-stat-card">
              <span className="stat-label">Employee Code</span>
              <strong className="stat-value">{employeeCode}</strong>
              <span className="stat-hint">Registered Staff ID</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Staff Role</span>
              <strong className="stat-value text-base">
                <Badge variant="primary" size="md">
                  {staffRoleDisplay}
                </Badge>
              </strong>
              <span className="stat-hint">Operational Designation</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Department</span>
              <strong className="stat-value text-base">{department}</strong>
              <span className="stat-hint">Assigned Station</span>
            </Card>
          </div>

          <div className="dashboard-main-section">
            <Card>
              <h3 className="section-title">Hospital Workflow Operations</h3>
              <p className="text-secondary text-sm mb-4">
                You are authenticated as hospital staff. Your access permissions allow
                coordinating patient check-in, tracking department queue stages, and managing
                operational flow.
              </p>

              <div className="status-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>OPD Intake & Registration</h4>
                  <p className="text-secondary text-xs" style={{ margin: 0 }}>
                    Patient profile verification and queue check-in status.
                  </p>
                </div>

                <div style={{ padding: '1rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Department Flow Coordination</h4>
                  <p className="text-secondary text-xs" style={{ margin: 0 }}>
                    Routing between OPD, Diagnostics, and Consultation rooms.
                  </p>
                </div>

                <div style={{ padding: '1rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Account Status</h4>
                  <Badge variant={profile?.staff_status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                    {profile?.staff_status || 'ACTIVE'}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
