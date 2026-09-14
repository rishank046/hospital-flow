import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  UserCheck,
  UserPlus,
  Search,
  Stethoscope,
  Building2,
  Calendar,
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
import type { AdminDoctor, CreateDoctorPayload } from '../../types/admin.types';

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

export function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [specFilter, setSpecFilter] = useState('ALL');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState('Cardiology');
  const [department, setDepartment] = useState('Cardiology Unit');

  const loadDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getDoctors();
      setDoctors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve doctors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    adminService
      .getDoctors()
      .then((data) => {
        if (mounted) {
          setDoctors(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve doctors.');
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
    setPassword('');
    setSpecialization('Cardiology');
    setDepartment('Cardiology Unit');
    setCreateError(null);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!name.trim() || !email.trim() || !password) {
      setCreateError('All fields including initial password are required.');
      return;
    }

    setCreateLoading(true);
    try {
      const payload: CreateDoctorPayload = {
        name: name.trim(),
        email: email.trim(),
        password,
        specialization,
        department: department.trim(),
      };

      await adminService.createDoctor(payload);
      setSuccessMessage(`Doctor ${name} registered successfully.`);
      setIsModalOpen(false);
      await loadDoctors();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to register doctor.');
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    if (specFilter !== 'ALL' && doc.specialization !== specFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.email.toLowerCase().includes(q) ||
        doc.department.toLowerCase().includes(q) ||
        doc.specialization.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <DashboardLayout
      pageTitle="Attending Physicians Directory"
      pageSubtitle="Clinical Staff Registry • Specializations & Department Rosters"
    >
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadDoctors}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" className="mb-4">
          {successMessage}
        </Alert>
      )}

      {/* Control Bar */}
      <Card className="mb-6">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
            <div style={{ minWidth: '240px', flex: 1 }}>
              <Input
                placeholder="Search doctors by name, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                className="form-input"
                value={specFilter}
                onChange={(e) => setSpecFilter(e.target.value)}
                aria-label="Filter by specialization"
              >
                <option value="ALL">All Specializations</option>
                {SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button variant="primary" icon={<UserPlus size={16} />} onClick={openCreateModal}>
            Add Attending Doctor
          </Button>
        </div>
      </Card>

      {/* Doctors Table */}
      {loading ? (
        <Spinner label="Loading doctor directory..." />
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Registered Physicians ({filteredDoctors.length})
            </h3>
            <span className="text-secondary text-sm">
              Showing {filteredDoctors.length} of {doctors.length} doctors
            </span>
          </div>

          {filteredDoctors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Stethoscope size={36} className="text-secondary" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p className="text-secondary">No doctors match the selected search criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <th style={{ padding: '0.75rem' }}>Doctor</th>
                    <th style={{ padding: '0.75rem' }}>Specialization</th>
                    <th style={{ padding: '0.75rem' }}>Department Station</th>
                    <th style={{ padding: '0.75rem' }}>Registered Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <UserCheck size={18} style={{ color: 'var(--primary-color, #0d9488)' }} />
                          <div>
                            <strong style={{ display: 'block' }}>{doc.name}</strong>
                            <span className="text-secondary text-xs">{doc.email}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <Badge variant="primary" size="sm">
                          {doc.specialization}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Building2 size={14} className="text-secondary" />
                          <span>{doc.department}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} className="text-secondary" />
                          <span className="text-secondary text-sm">
                            {new Date(doc.created_at).toLocaleDateString(undefined, {
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

      {/* Add Doctor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Attending Doctor"
      >
        <form onSubmit={handleCreateSubmit}>
          {createError && <Alert type="error" className="mb-4">{createError}</Alert>}

          <Input
            label="Doctor Full Name"
            placeholder="e.g. Dr. Arthur Conan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Hospital Email Address"
            type="email"
            placeholder="doctor@hospital.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Initial Password"
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <div className="form-field">
            <label className="form-label">Clinical Specialization</label>
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
            label="Assigned Department"
            placeholder="e.g. Cardiology, Radiology, Pediatrics"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={createLoading} icon={<UserCheck size={16} />}>
              Register Doctor
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
