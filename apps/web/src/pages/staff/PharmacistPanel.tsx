import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Pill,
  CheckCircle2,
  RefreshCw,
  Search,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { staffService } from '../../services/staff.service';
import type { PrescriptionItem } from '../../types/staff.types';

export function PharmacistPanel() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'DISPENSED' | 'ALL'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  // Dispense modal state
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dispenseQty, setDispenseQty] = useState('1');
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadPrescriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load based on status filter
      const filterParam = statusFilter === 'ALL' ? undefined : statusFilter;
      const data = await staffService.getPrescriptions(filterParam);
      setPrescriptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescriptions queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const filterParam = statusFilter === 'ALL' ? undefined : statusFilter;
    staffService
      .getPrescriptions(filterParam)
      .then((data) => {
        if (mounted) {
          setPrescriptions(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load prescriptions queue.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [statusFilter]);

  const openDispenseModal = (prescription: PrescriptionItem) => {
    setSelectedPrescription(prescription);
    setDispenseQty('1');
    setDispenseNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeDispenseModal = () => {
    setIsModalOpen(false);
    setSelectedPrescription(null);
  };

  const handleDispenseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPrescription) return;

    const qty = parseInt(dispenseQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Please provide a valid dispense quantity (at least 1).');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await staffService.dispensePrescription(selectedPrescription.id, {
        quantity: qty,
        notes: dispenseNotes.trim() || null,
      });

      setSuccessMessage(
        `Successfully dispensed ${selectedPrescription.medication} to ${selectedPrescription.patient_name || 'patient'}.`
      );
      closeDispenseModal();
      loadPrescriptions();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to dispense prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const medMatch = item.medication.toLowerCase().includes(q);
    const patMatch = (item.patient_name || '').toLowerCase().includes(q);
    const docMatch = (item.doctor_name || '').toLowerCase().includes(q);
    const instrMatch = (item.instructions || '').toLowerCase().includes(q);
    return medMatch || patMatch || docMatch || instrMatch;
  });

  const pendingCount = prescriptions.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="pharmacist-panel">
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadPrescriptions}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" className="mb-4">
          {successMessage}
        </Alert>
      )}

      {/* Metrics Row */}
      <div className="metrics-summary-row mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Card className="summary-stat-card">
          <span className="stat-label">Pending Dispense</span>
          <strong className="stat-value">{statusFilter === 'PENDING' ? filteredPrescriptions.length : pendingCount}</strong>
          <span className="stat-hint">Active medication orders</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Pharmacy Station</span>
          <strong className="stat-value text-base">Dispensing Unit A</strong>
          <span className="stat-hint">Connected to OPD Care Stream</span>
        </Card>
      </div>

      {/* Main Prescriptions Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              Pharmacy Prescription Orders
            </h3>
            <p className="text-secondary text-sm" style={{ margin: 0 }}>
              Fulfill prescribed medications issued by attending physicians.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant={statusFilter === 'PENDING' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending Orders
            </Button>
            <Button
              variant={statusFilter === 'DISPENSED' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('DISPENSED')}
            >
              Dispensed History
            </Button>
            <Button
              variant={statusFilter === 'ALL' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('ALL')}
            >
              All Prescriptions
            </Button>
            <Button
              variant="outline"
              onClick={loadPrescriptions}
              loading={loading}
              icon={<RefreshCw size={16} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1rem', maxWidth: '380px' }}>
          <Input
            placeholder="Search by medication, patient, or doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>

        {loading ? (
          <Spinner label="Loading prescriptions..." />
        ) : filteredPrescriptions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary, #64748b)' }}>
            <Clock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>
              No prescriptions found in {statusFilter.toLowerCase()} status.
            </p>
            <p className="text-xs" style={{ margin: '0.25rem 0 0' }}>
              Doctor-issued prescriptions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  <th style={{ padding: '0.75rem' }}>Medication</th>
                  <th style={{ padding: '0.75rem' }}>Dosage & Regime</th>
                  <th style={{ padding: '0.75rem' }}>Patient Name</th>
                  <th style={{ padding: '0.75rem' }}>Prescribing Doctor</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Prescribed At</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrescriptions.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Pill size={15} color="var(--primary-color, #0284c7)" />
                        {p.medication}
                      </strong>
                      {p.instructions && (
                        <span className="text-secondary text-xs" style={{ display: 'block', marginTop: '2px' }}>
                          Note: {p.instructions}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span>{p.dosage}</span>
                      {(p.frequency || p.duration) && (
                        <span className="text-secondary text-xs" style={{ display: 'block' }}>
                          {[p.frequency, p.duration].filter(Boolean).join(' • ')}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <strong>{p.patient_name || 'Patient'}</strong>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {p.doctor_name ? `Dr. ${p.doctor_name}` : 'Attending Doctor'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <Badge
                        variant={p.status === 'PENDING' ? 'warning' : p.status === 'DISPENSED' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
                      {new Date(p.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {p.status === 'PENDING' ? (
                        <Button
                          variant="primary"
                          onClick={() => openDispenseModal(p)}
                          icon={<CheckCircle2 size={15} />}
                        >
                          Dispense
                        </Button>
                      ) : (
                        <span className="text-secondary text-xs">Dispensed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Dispense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeDispenseModal}
        title={`Dispense Medication: ${selectedPrescription?.medication || ''}`}
      >
        <form onSubmit={handleDispenseSubmit}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--surface-subtle, #f8fafc)', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>
              {selectedPrescription?.medication} ({selectedPrescription?.dosage})
            </p>
            <p className="text-xs text-secondary" style={{ margin: '0 0 0.25rem' }}>
              Patient: <strong>{selectedPrescription?.patient_name || 'Patient'}</strong> • Doctor: <strong>Dr. {selectedPrescription?.doctor_name || 'Attending'}</strong>
            </p>
            {selectedPrescription?.instructions && (
              <p className="text-xs" style={{ margin: 0, color: 'var(--primary-color, #0284c7)' }}>
                Directions: {selectedPrescription.instructions}
              </p>
            )}
          </div>

          {formError && (
            <Alert type="error" className="mb-4">
              {formError}
            </Alert>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <Input
              label="Dispense Quantity *"
              type="number"
              min="1"
              value={dispenseQty}
              onChange={(e) => setDispenseQty(e.target.value)}
              required
            />

            <Input
              label="Dispense Notes / Verification"
              placeholder="e.g. Verified dosage, instructions handed to patient"
              value={dispenseNotes}
              onChange={(e) => setDispenseNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" type="button" onClick={closeDispenseModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} icon={<CheckCircle2 size={16} />}>
              Confirm Dispense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
