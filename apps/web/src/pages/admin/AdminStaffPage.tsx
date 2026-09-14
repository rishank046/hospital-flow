import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  Copy,
  Check,
  Edit,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Spinner } from '../../components/common/Spinner';
import { Alert } from '../../components/common/Alert';
import { adminService } from '../../services/admin.service';
import type {
  AdminStaffMember,
  CreateStaffPayload,
  CreateStaffResponse,
} from '../../types/admin.types';
import type { StaffRole } from '../../types/auth.types';

const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Pediatrics',
  'Psychiatry',
  'Radiology',
  'Surgery',
  'Urology',
  'Oncology',
  'Orthopedics',
];

const STAFF_ROLES: StaffRole[] = [
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'PHARMACIST',
  'LAB_TECH',
  'BILLING_CLERK',
  'LAB_STAFF',
];

export function AdminStaffPage() {
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreateStaffResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Create Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('NURSE');
  const [department, setDepartment] = useState('General Medicine');
  const [specialization, setSpecialization] = useState('Cardiology');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [customPassword, setCustomPassword] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getStaff();
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    adminService
      .getStaff()
      .then((data) => {
        if (mounted) {
          setStaff(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load staff list.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openCreateModal = () => {
    setName('');
    setEmail('');
    setRole('NURSE');
    setDepartment('General Medicine');
    setSpecialization('Cardiology');
    setLicenseNumber('');
    setEmployeeCode('');
    setCustomPassword('');
    setCreateError(null);
    setCreatedResult(null);
    setCopied(false);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!name.trim() || !email.trim()) {
      setCreateError('Name and email are required.');
      return;
    }

    setCreateLoading(true);
    try {
      const payload: CreateStaffPayload = {
        name: name.trim(),
        email: email.trim(),
        role,
        department: department.trim(),
        status: 'ACTIVE',
      };

      if (employeeCode.trim()) {
        payload.employeeCode = employeeCode.trim();
      }
      if (customPassword.trim()) {
        payload.password = customPassword.trim();
      }

      if (role === 'DOCTOR') {
        payload.specialization = specialization;
        if (licenseNumber.trim()) {
          payload.licenseNumber = licenseNumber.trim();
        }
      }

      const res = await adminService.createStaff(payload);
      setCreatedResult(res);
      await loadStaff();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create staff account.');
    } finally {
      setCreateLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const navigateToDetail = (staffId: string) => {
    window.history.pushState({}, '', `/admin/staff/${staffId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const filteredStaff = staff.filter((member) => {
    const memberRole = (member.staff_role || member.role || '').toUpperCase();
    const memberStatus = (member.staff_status || member.status || '').toUpperCase();

    if (roleFilter !== 'ALL' && memberRole !== roleFilter) {
      return false;
    }
    if (statusFilter !== 'ALL' && memberStatus !== statusFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = member.name.toLowerCase().includes(q);
      const emailMatch = member.email.toLowerCase().includes(q);
      const codeMatch = (member.employee_code || '').toLowerCase().includes(q);
      const deptMatch = (member.department || '').toLowerCase().includes(q);
      return nameMatch || emailMatch || codeMatch || deptMatch;
    }

    return true;
  });

  return (
    <DashboardLayout
      pageTitle="Staff Management"
      pageSubtitle="Hospital Personnel Directory • Credentials & Roles"
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadStaff}>
          {error}
        </Alert>
      )}

      {/* Header Actions & Filter Controls */}
      <Card className="mb-6">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
            {/* Search Input */}
            <div style={{ minWidth: '240px', flex: 1 }}>
              <Input
                placeholder="Search staff by name, email, or employee code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>

            {/* Role Filter */}
            <div style={{ minWidth: '160px' }}>
              <select
                className="form-input"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by staff role"
              >
                <option value="ALL">All Roles</option>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '140px' }}>
              <select
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by account status"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
              </select>
            </div>
          </div>

          <Button variant="primary" icon={<UserPlus size={16} />} onClick={openCreateModal}>
            Create Staff Account
          </Button>
        </div>
      </Card>

      {/* Staff Table */}
      {loading ? (
        <Spinner label="Loading staff directory..." />
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Hospital Personnel ({filteredStaff.length})
            </h3>
            <span className="text-secondary text-sm">
              Showing {filteredStaff.length} of {staff.length} accounts
            </span>
          </div>

          {filteredStaff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Filter size={36} className="text-secondary" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p className="text-secondary">No staff members match the selected filters.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <th style={{ padding: '0.75rem' }}>Employee Code</th>
                    <th style={{ padding: '0.75rem' }}>Name & Email</th>
                    <th style={{ padding: '0.75rem' }}>Role</th>
                    <th style={{ padding: '0.75rem' }}>Department</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((member) => {
                    const memberRole = member.staff_role || member.role || 'STAFF';
                    const memberStatus = member.staff_status || member.status || 'ACTIVE';
                    const memberId = member.staff_id || member.id;

                    return (
                      <tr
                        key={memberId}
                        style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                      >
                        <td style={{ padding: '0.75rem' }}>
                          <code style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {member.employee_code || 'PENDING'}
                          </code>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <strong style={{ display: 'block' }}>{member.name}</strong>
                          <span className="text-secondary text-xs">{member.email}</span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <Badge
                            variant={memberRole === 'DOCTOR' ? 'primary' : 'neutral'}
                            size="sm"
                          >
                            {memberRole}
                          </Badge>
                          {member.specialization && (
                            <span className="text-secondary text-xs" style={{ display: 'block', marginTop: '2px' }}>
                              {member.specialization}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {member.department || 'General Operations'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <Badge
                            variant={
                              memberStatus === 'ACTIVE'
                                ? 'success'
                                : memberStatus === 'INACTIVE'
                                ? 'danger'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {memberStatus}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <Button
                            variant="outline"
                            className="btn-sm"
                            icon={<Edit size={14} />}
                            onClick={() => navigateToDetail(memberId)}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Create Staff Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={createdResult ? 'Staff Account Created' : 'Provision Staff Account'}
      >
        {createdResult ? (
          <div>
            <Alert type="success" className="mb-4">
              Staff account for <strong>{createdResult.user.name}</strong> created successfully!
            </Alert>

            <div
              style={{
                background: 'var(--card-bg-subtle, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <span className="text-secondary text-xs" style={{ display: 'block' }}>
                  Login Email Address
                </span>
                <strong style={{ fontSize: '0.95rem' }}>{createdResult.user.email}</strong>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <span className="text-secondary text-xs" style={{ display: 'block' }}>
                  Assigned Employee Code
                </span>
                <strong>{createdResult.staff.employeeCode}</strong>
              </div>

              <div>
                <span className="text-secondary text-xs" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Temporary Initial Password
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    readOnly
                    value={createdResult.temporaryPassword}
                    className="form-input"
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      background: '#fff',
                    }}
                  />
                  <Button
                    variant={copied ? 'secondary' : 'primary'}
                    icon={copied ? <Check size={16} /> : <Copy size={16} />}
                    onClick={() => copyToClipboard(createdResult.temporaryPassword)}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                color: '#92400e',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Important Notice:</strong> Share this temporary password directly with the
                employee. For privacy and compliance, this password is not emailed and cannot be retrieved later.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={() => setIsCreateOpen(false)}>
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit}>
            {createError && <Alert type="error" className="mb-4">{createError}</Alert>}

            <Input
              label="Full Name"
              placeholder="e.g. Dr. Jennifer Adams"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Staff Official Email"
              type="email"
              placeholder="employee@hospital.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              label="Department Station"
              placeholder="e.g. Emergency, Cardiology, Diagnostics"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />

            {role === 'DOCTOR' && (
              <>
                <div className="form-field">
                  <label className="form-label">Medical Specialization</label>
                  <select
                    className="form-input"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  >
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Medical License Number"
                  placeholder="e.g. MED-2026-98104"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </>
            )}

            <Input
              label="Employee Code (Optional)"
              placeholder="Leave blank to auto-generate"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
            />

            <Input
              label="Custom Initial Password (Optional)"
              placeholder="Leave blank to auto-generate secure password"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={createLoading} icon={<ShieldCheck size={16} />}>
                Create Account
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}
