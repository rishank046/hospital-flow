import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  Heart,
  Activity,
  Receipt,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { adminService } from '../../services/admin.service';
import type { AdminDashboardStats } from '../../types/admin.types';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    adminService
      .getDashboardStats()
      .then((data) => {
        if (mounted) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <DashboardLayout
      pageTitle="Hospital Operations Administration"
      pageSubtitle="Unified Control Center • Enterprise Healthcare Flow"
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadStats}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading operational metrics..." />
      ) : (
        <div className="dashboard-content-grid">
          {/* Top Metric Cards */}
          <div className="metrics-summary-row">
            <Card className="summary-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Total Staff Members</span>
                <Users size={18} className="text-secondary" />
              </div>
              <strong className="stat-value">{stats?.totalStaff ?? 0}</strong>
              <span className="stat-hint">
                <Badge variant="success" size="sm">
                  {stats?.activeStaff ?? 0} Active
                </Badge>{' '}
                on duty
              </span>
            </Card>

            <Card className="summary-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Active OPD Visits</span>
                <Activity size={18} className="text-secondary" />
              </div>
              <strong className="stat-value">{stats?.activeVisitsToday ?? 0}</strong>
              <span className="stat-hint">Live queue encounters</span>
            </Card>

            <Card className="summary-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Pending Invoices</span>
                <Receipt size={18} className="text-secondary" />
              </div>
              <strong className="stat-value">{stats?.pendingInvoicesCount ?? 0}</strong>
              <span className="stat-hint">
                ₹{(stats?.pendingInvoicesAmount ?? 0).toLocaleString()} awaiting payment
              </span>
            </Card>

            <Card className="summary-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Registered Patients</span>
                <Heart size={18} className="text-secondary" />
              </div>
              <strong className="stat-value">{stats?.totalPatients ?? 0}</strong>
              <span className="stat-hint">Total hospital records</span>
            </Card>
          </div>

          {/* Workforce Breakdown */}
          <div className="dashboard-main-section">
            <Card className="mb-6">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 className="section-title" style={{ margin: 0 }}>Workforce Distribution by Role</h3>
                  <p className="text-secondary text-sm" style={{ margin: '0.25rem 0 0' }}>
                    Real-time operational allocation across clinical and administration units
                  </p>
                </div>
                <Button variant="outline" onClick={() => navigateTo('/admin/staff')}>
                  Manage Staff
                </Button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                {stats?.staffByRole && Object.keys(stats.staffByRole).length > 0 ? (
                  Object.entries(stats.staffByRole).map(([roleName, count]) => (
                    <div
                      key={roleName}
                      style={{
                        padding: '1rem',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '8px',
                        background: 'var(--card-bg-subtle, #f8fafc)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-primary)' }}>
                          {roleName}
                        </strong>
                        <span className="text-secondary text-xs">Assigned Personnel</span>
                      </div>
                      <Badge variant="primary" size="md">
                        {count}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-secondary text-sm">No staff members configured yet.</p>
                )}
              </div>
            </Card>

            {/* Quick Action Navigation Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Shield size={20} style={{ color: 'var(--primary-color, #0d9488)' }} />
                  <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Staff Management</h4>
                </div>
                <p className="text-secondary text-sm mb-4">
                  Provision new employee accounts with secure temporary passwords, modify assignments, and manage statuses.
                </p>
                <Button variant="primary" onClick={() => navigateTo('/admin/staff')}>
                  <span>View All Staff</span>
                  <ArrowRight size={14} style={{ marginLeft: '0.5rem' }} />
                </Button>
              </Card>

              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <UserCheck size={20} style={{ color: 'var(--primary-color, #0d9488)' }} />
                  <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Doctor Directory</h4>
                </div>
                <p className="text-secondary text-sm mb-4">
                  Review attending physicians, specializations, medical licenses, and departmental affiliations.
                </p>
                <Button variant="primary" onClick={() => navigateTo('/admin/doctors')}>
                  <span>View Doctors</span>
                  <ArrowRight size={14} style={{ marginLeft: '0.5rem' }} />
                </Button>
              </Card>

              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Heart size={20} style={{ color: 'var(--primary-color, #0d9488)' }} />
                  <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Patient Registry</h4>
                </div>
                <p className="text-secondary text-sm mb-4">
                  Audit registered patient accounts, demographics, care intake modes, and family account ownerships.
                </p>
                <Button variant="primary" onClick={() => navigateTo('/admin/patients')}>
                  <span>View Patients</span>
                  <ArrowRight size={14} style={{ marginLeft: '0.5rem' }} />
                </Button>
              </Card>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
