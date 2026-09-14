import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Shield,
  Briefcase,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { adminService } from '../../services/admin.service';
import type { AdminStaffMember, UpdateStaffPayload } from '../../types/admin.types';
import type { StaffRole, StaffStatus } from '../../types/auth.types';

const STAFF_ROLES: StaffRole[] = [
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'PHARMACIST',
  'LAB_TECH',
  'BILLING_CLERK',
  'LAB_STAFF',
];

interface AdminStaffDetailPageProps {
  staffId?: string;
}

export function AdminStaffDetailPage({ staffId: propStaffId }: AdminStaffDetailPageProps) {
  // Resolve staffId from prop or URL
  const staffId =
    propStaffId ||
    window.location.pathname.replace('/admin/staff/', '').split('/')[0];

  const [member, setMember] = useState<AdminStaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [role, setRole] = useState<StaffRole>('STAFF' as StaffRole);
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState<StaffStatus>('ACTIVE');

  // Action feedback states
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [savingStatus, setSavingStatus] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadMember = async () => {
    setLoading(true);
    setError(null);
    try {
      const allStaff = await adminService.getStaff();
      const target = allStaff.find(
        (s) => s.id === staffId || s.staff_id === staffId
      );
      if (!target) {
        setError('Staff member profile not found.');
      } else {
        setMember(target);
        setName(target.name);
        setEmail(target.email);
        setEmployeeCode(target.employee_code || '');
        setRole((target.staff_role || target.role || 'STAFF') as StaffRole);
        setDepartment(target.department || '');
        setStatus((target.staff_status || target.status || 'ACTIVE') as StaffStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve staff details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    adminService
      .getStaff()
      .then((allStaff) => {
        if (!mounted) return;
        const target = allStaff.find(
          (s) => s.id === staffId || s.staff_id === staffId
        );
        if (!target) {
          setError('Staff member profile not found.');
        } else {
          setMember(target);
          setName(target.name);
          setEmail(target.email);
          setEmployeeCode(target.employee_code || '');
          setRole((target.staff_role || target.role || 'STAFF') as StaffRole);
          setDepartment(target.department || '');
          setStatus((target.staff_status || target.status || 'ACTIVE') as StaffStatus);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to retrieve staff details.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [staffId]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    setSavingProfile(true);
    try {
      const payload: UpdateStaffPayload = {
        name: name.trim(),
        email: email.trim(),
        employeeCode: employeeCode.trim(),
        role,
        department: department.trim(),
      };

      const updated = await adminService.updateStaff(staffId, payload);
      setProfileSuccess('Staff details updated successfully.');
      setMember((prev) => (prev ? { ...prev, ...updated, name: payload.name!, email: payload.email! } : null));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update staff record.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateStatus = async (e: FormEvent) => {
    e.preventDefault();
    setStatusSuccess(null);
    setStatusError(null);

    setSavingStatus(true);
    try {
      await adminService.updateStaffStatus(staffId, status);
      setStatusSuccess(`Staff status updated to ${status}.`);
      setMember((prev) =>
        prev
          ? {
              ...prev,
              status,
              staff_status: status,
              is_active: status === 'ACTIVE',
            }
          : null
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update account status.');
    } finally {
      setSavingStatus(false);
    }
  };

  const navigateBack = () => {
    window.history.pushState({}, '', '/admin/staff');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <DashboardLayout
      pageTitle={member ? `Staff Record: ${member.name}` : 'Staff Profile Management'}
      pageSubtitle={`Employee ID: ${member?.employee_code || staffId} • Hospital Administration`}
    >
      <div className="mb-4">
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={navigateBack}>
          Back to Staff Directory
        </Button>
      </div>

      {error && (
        <Alert type="error" className="mb-4" onRetry={loadMember}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Loading staff member details..." />
      ) : !member ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p className="text-secondary">Staff profile not found.</p>
            <Button variant="primary" onClick={navigateBack}>
              Return to Staff Directory
            </Button>
          </div>
        </Card>
      ) : (
        <div className="dashboard-content-grid">
          {/* Header Summary Card */}
          <div className="metrics-summary-row">
            <Card className="summary-stat-card">
              <span className="stat-label">Employee Code</span>
              <strong className="stat-value text-base">{member.employee_code || 'PENDING'}</strong>
              <span className="stat-hint">Registered Staff Identifier</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">Assigned Role</span>
              <strong className="stat-value text-base">
                <Badge variant={member.staff_role === 'DOCTOR' ? 'primary' : 'neutral'} size="md">
                  {member.staff_role || member.role}
                </Badge>
              </strong>
              <span className="stat-hint">{member.department || 'General Operations'}</span>
            </Card>

            <Card className="summary-stat-card">
              <span className="stat-label">System Account Status</span>
              <strong className="stat-value text-base">
                <Badge
                  variant={
                    member.status === 'ACTIVE'
                      ? 'success'
                      : member.status === 'INACTIVE'
                      ? 'danger'
                      : 'warning'
                  }
                  size="md"
                >
                  {member.status || 'ACTIVE'}
                </Badge>
              </strong>
              <span className="stat-hint">
                {member.is_active ? 'Login Allowed' : 'Access Barred'}
              </span>
            </Card>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Status Management Section */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Shield size={20} style={{ color: 'var(--primary-color, #0d9488)' }} />
                <h3 className="section-title" style={{ margin: 0 }}>
                  Account Status & Access Control
                </h3>
              </div>
              <p className="text-secondary text-sm mb-4">
                Toggle the operational employment status. Deactivating revokes system login privileges immediately.
              </p>

              {statusSuccess && (
                <Alert type="success" className="mb-4">
                  {statusSuccess}
                </Alert>
              )}
              {statusError && (
                <Alert type="error" className="mb-4">
                  {statusError}
                </Alert>
              )}

              <form onSubmit={handleUpdateStatus}>
                <div className="form-field">
                  <label className="form-label">Current Operational Status</label>
                  <select
                    className="form-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StaffStatus)}
                  >
                    <option value="ACTIVE">ACTIVE (Access Enabled)</option>
                    <option value="INACTIVE">INACTIVE (Deactivated & Login Barred)</option>
                    <option value="ON_LEAVE">ON_LEAVE (Temporary Leave)</option>
                  </select>
                </div>

                {status === 'INACTIVE' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      padding: '0.85rem',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#991b1b',
                      fontSize: '0.85rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Security Warning:</strong> Setting status to INACTIVE immediately marks
                      <code>User.is_active = false</code> and prevents the staff member from authenticating.
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant={status === 'INACTIVE' ? 'danger' : 'primary'}
                  loading={savingStatus}
                  icon={<Save size={16} />}
                >
                  Save Status Change
                </Button>
              </form>
            </Card>

            {/* Profile Modification Section */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Briefcase size={20} style={{ color: 'var(--primary-color, #0d9488)' }} />
                <h3 className="section-title" style={{ margin: 0 }}>
                  Modify Staff Profile
                </h3>
              </div>
              <p className="text-secondary text-sm mb-4">
                Update employee credentials, workplace department, and assigned organizational role.
              </p>

              {profileSuccess && (
                <Alert type="success" className="mb-4">
                  {profileSuccess}
                </Alert>
              )}
              {profileError && (
                <Alert type="error" className="mb-4">
                  {profileError}
                </Alert>
              )}

              <form onSubmit={handleUpdateProfile}>
                <Input
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <Input
                  label="Official Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Input
                  label="Employee Code"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  required
                />

                <div className="form-field">
                  <label className="form-label">Staff Role</label>
                  <select
                    className="form-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value as StaffRole)}
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Station / Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                />

                <div style={{ marginTop: '1.25rem' }}>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={savingProfile}
                    icon={<CheckCircle size={16} />}
                  >
                    Save Profile Updates
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
