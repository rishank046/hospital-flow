import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { getStaffRolePresentation } from '../../utils/roleConfig';
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
  const { user, staffRole: authStaffRole } = useAuth();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safeguard: DOCTOR staffRole must never be routed to the general staff portal
  useEffect(() => {
    if ((authStaffRole === 'DOCTOR' || user?.staffRole === 'DOCTOR') && !roleOverride) {
      window.history.replaceState({}, '', '/staff/doctor/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [authStaffRole, user?.staffRole, roleOverride]);

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

  const rawStaffRole = roleOverride || profile?.staff_role || authStaffRole || user?.staffRole;
  const isRoleResolved = Boolean(rawStaffRole);

  // Neutral loading state while role is unresolved
  if (loading && !isRoleResolved) {
    return (
      <LoadingScreen
        message="Loading staff workstation..."
        supportingText="Resolving operational role assignment & department credentials"
      />
    );
  }

  const rolePresentation = getStaffRolePresentation(rawStaffRole);
  const employeeCode = profile?.employee_code || user?.employeeCode || 'STAFF-ID';
  const department = profile?.department || user?.department || rolePresentation.departmentLabel;
  const staffName = profile?.name || user?.name || 'Staff Member';

  // Unknown or unsupported role safety state (Section 7)
  if (!rolePresentation.isSupportedStaffRole || rolePresentation.panelKey === 'UNSUPPORTED') {
    return (
      <DashboardLayout
        pageTitle="Staff Workspace Unavailable"
        pageSubtitle="Operational Access Control • Department Unassigned"
      >
        <div className="unsupported-role-card">
          <div
            className="empty-state-icon"
            style={{ margin: '0 auto 16px', background: '#fee2e2', color: '#dc2626' }}
            aria-hidden="true"
          >
            <AlertTriangle size={32} />
          </div>
          <h3>Staff Workspace Unavailable</h3>
          <p>
            Resolved role: <strong>{rawStaffRole || 'UNKNOWN'}</strong>
          </p>
          <p>
            This staff role is not configured for an active workstation panel in this hospital facility.
          </p>
          <p className="text-muted text-xs" style={{ margin: '12px 0 20px' }}>
            Please contact the hospital administrator to assign a valid workstation station.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              window.history.pushState({}, '', '/login');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            Return to Login
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const renderRolePanel = () => {
    switch (rolePresentation.panelKey) {
      case 'RECEPTIONIST':
        return <ReceptionistPanel />;
      case 'NURSE':
        return <NursePanel />;
      case 'PHARMACIST':
        return <PharmacistPanel />;
      case 'LAB_TECH':
        return <LabTechPanel />;
      case 'BILLING_CLERK':
        return <BillingClerkPanel />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      pageTitle={`${rolePresentation.displayName} Workstation`}
      pageSubtitle={`${department} • Operator: ${staffName}`}
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadProfile}>
          {error}
        </Alert>
      )}

      {/* Shared Staff Identity Strip */}
      <div className="workstation-identity-strip">
        <div className="identity-item">
          <span className="identity-label">Operator</span>
          <span className="identity-value">{staffName}</span>
        </div>

        <div className="identity-item">
          <span className="identity-label">Workstation Role</span>
          <span className="identity-value">
            <Badge variant={rolePresentation.badgeVariant} size="sm">
              {rolePresentation.displayName}
            </Badge>
          </span>
        </div>

        <div className="identity-item">
          <span className="identity-label">Employee ID</span>
          <span className="identity-value">
            <code>{employeeCode}</code>
          </span>
        </div>

        <div className="identity-item">
          <span className="identity-label">Station / Bench</span>
          <span className="identity-value">{rolePresentation.stationLabel}</span>
        </div>

        <div className="identity-item">
          <span className="identity-label">Status</span>
          <span className="identity-value">
            <Badge variant={profile?.staff_status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
              {profile?.staff_status || 'ACTIVE'}
            </Badge>
          </span>
        </div>
      </div>

      {loading ? (
        <Spinner label={`Loading ${rolePresentation.displayName.toLowerCase()} workstation...`} />
      ) : (
        renderRolePanel()
      )}
    </DashboardLayout>
  );
}

export default StaffDashboardPage;

