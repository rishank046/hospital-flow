import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { staffService } from '../../services/staff.service';
import type { StaffProfile } from '../../types/staff.types';
import type { StaffRole } from '../../types/auth.types';
import { ReceptionistPanel } from './ReceptionistPanel';
import { NursePanel } from './NursePanel';
import { PharmacistPanel } from './PharmacistPanel';
import { LabTechPanel } from './LabTechPanel';
import { BillingClerkPanel } from './BillingClerkPanel';

interface StaffDashboardPageProps {
  roleOverride?: StaffRole;
}

export function StaffDashboardPage({ roleOverride }: StaffDashboardPageProps = {}) {
  const { user, staffRole } = useAuth();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safeguard: DOCTOR staffRole must never be routed to the general staff portal
  useEffect(() => {
    if ((staffRole === 'DOCTOR' || user?.staffRole === 'DOCTOR') && !roleOverride) {
      window.history.replaceState({}, '', '/staff/doctor/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [staffRole, user?.staffRole, roleOverride]);

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
    let mounted = true;
    staffService
      .getProfile()
      .then((data) => {
        if (mounted) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load staff profile.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const effectiveStaffRole = (roleOverride || profile?.staff_role || user?.staffRole || 'OPD_MANAGER').toUpperCase();
  const employeeCode = profile?.employee_code || user?.employeeCode || 'STAFF-ID';
  const department = profile?.department || user?.department || 'Clinical Operations';
  const staffName = profile?.name || user?.name || 'Staff Member';

  const renderRolePanel = () => {
    switch (effectiveStaffRole) {
      case 'OPD_MANAGER':
      case 'RECEPTIONIST':
        return <ReceptionistPanel />;
      case 'NURSE':
        return <NursePanel />;
      case 'PHARMACIST':
        return <PharmacistPanel />;
      case 'LAB_TECH':
      case 'LAB_STAFF':
        return <LabTechPanel />;
      case 'BILLING_CLERK':
        return <BillingClerkPanel />;
      default:
        return <ReceptionistPanel />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OPD_MANAGER':
        return 'primary';
      case 'NURSE':
        return 'primary';
      case 'PHARMACIST':
        return 'success';
      case 'LAB_TECH':
      case 'LAB_STAFF':
        return 'warning';
      case 'RECEPTIONIST':
        return 'primary';
      case 'BILLING_CLERK':
        return 'success';
      default:
        return 'neutral';
    }
  };

  return (
    <DashboardLayout
      pageTitle={`Staff Portal: ${staffName}`}
      pageSubtitle={`Operational Area • Role: ${effectiveStaffRole}`}
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadProfile}>
          {error}
        </Alert>
      )}

      {/* Shared Staff Profile & Station Bar */}
      <div className="metrics-summary-row mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Card className="summary-stat-card">
          <span className="stat-label">Employee Code</span>
          <strong className="stat-value">{employeeCode}</strong>
          <span className="stat-hint">Assigned Staff ID</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Staff Role</span>
          <strong className="stat-value text-base">
            <Badge variant={getRoleBadgeVariant(effectiveStaffRole)} size="md">
              {effectiveStaffRole}
            </Badge>
          </strong>
          <span className="stat-hint">Clinical Role Designation</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Department</span>
          <strong className="stat-value text-base">{department}</strong>
          <span className="stat-hint">Hospital Department Station</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Account Status</span>
          <strong className="stat-value text-base">
            <Badge variant={profile?.staff_status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
              {profile?.staff_status || 'ACTIVE'}
            </Badge>
          </strong>
          <span className="stat-hint">Authorized Credentials</span>
        </Card>
      </div>

      {loading ? (
        <Spinner label="Loading operational workstation..." />
      ) : (
        renderRolePanel()
      )}
    </DashboardLayout>
  );
}

export default StaffDashboardPage;
