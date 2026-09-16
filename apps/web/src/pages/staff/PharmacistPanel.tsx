import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Pill,
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
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
  const dispensedCount = prescriptions.filter((p) => p.status === 'DISPENSED').length;

  return (
    <div className="pharmacist-panel">
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadPrescriptions}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" className="mb-4" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Workspace Header */}
      <div className="station-header">
        <div className="station-header-info">
          <h3>
            <Pill size={20} aria-hidden="true" />
            Pharmacy Dispensing Counter
          </h3>
          <p>Prescription verification, clinical medication dispensing, and pharmaceutical fulfillment</p>
        </div>

        <div className="station-header-actions">
          <Button
            variant="outline"
            onClick={loadPrescriptions}
            loading={loading}
            icon={<RefreshCw size={16} />}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Workload Summary (Section 12) */}
      <div className="metrics-summary-row mb-6">
        <Card className="summary-stat-card">
          <span className="stat-label">Pending Dispense</span>
          <strong className="stat-value">{pendingCount}</strong>
          <span className="stat-hint">Active prescriptions requiring fulfillment</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Dispensed Today</span>
          <strong className="stat-value">{dispensedCount}</strong>
          <span className="stat-hint">Completed medication handouts</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Total Prescription Orders</span>
          <strong className="stat-value">{prescriptions.length}</strong>
          <span className="stat-hint">Full prescription register</span>
        </Card>
      </div>

      {/* Main Prescriptions Table */}
      <Card>
        <div className="station-header" style={{ marginBottom: '14px' }}>
          <div className="station-header-info">
            <h3 style={{ fontSize: '18px' }}>
              Prescription Orders ({filteredPrescriptions.length})
            </h3>
            <p>Fulfill doctor-issued prescriptions for attending patients</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="station-filter-bar">
          <div className="station-search-box">
            <Input
              placeholder="Search by medication, patient, or doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Pharmacy status filter">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'PENDING'}
              className={`filter-tab-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending Orders ({pendingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'DISPENSED'}
              className={`filter-tab-btn ${statusFilter === 'DISPENSED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('DISPENSED')}
            >
              Dispensed History ({dispensedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'ALL'}
              className={`filter-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Prescriptions ({prescriptions.length})
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading prescriptions..." />
        ) : filteredPrescriptions.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No prescriptions found"
            description="No prescriptions match the selected status filter. Doctor prescriptions will appear here automatically."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Dosage & Regime</th>
                  <th>Patient Name</th>
                  <th>Prescribing Doctor</th>
                  <th>Status</th>
                  <th>Prescribed At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrescriptions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Pill size={15} color="#165b53" aria-hidden="true" />
                        {p.medication}
                      </strong>
                      {p.instructions && (
                        <span className="cell-meta" style={{ display: 'block', marginTop: '2px' }}>
                          Note: {p.instructions}
                        </span>
                      )}
                    </td>
                    <td>
                      <span>{p.dosage}</span>
                      {(p.frequency || p.duration) && (
                        <span className="cell-meta" style={{ display: 'block' }}>
                          {[p.frequency, p.duration].filter(Boolean).join(' • ')}
                        </span>
                      )}
                    </td>
                    <td className="cell-name">{p.patient_name || 'Patient'}</td>
                    <td className="cell-meta">
                      {p.doctor_name ? `Dr. ${p.doctor_name}` : 'Attending Doctor'}
                    </td>
                    <td>
                      <Badge
                        variant={p.status === 'PENDING' ? 'warning' : p.status === 'DISPENSED' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="cell-meta">
                      {new Date(p.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="cell-actions">
                      {p.status === 'PENDING' ? (
                        <Button
                          variant="primary"
                          size="sm"
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
