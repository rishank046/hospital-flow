import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  FlaskConical,
  CheckCircle2,
  RefreshCw,
  Search,
  Clock,
  FileEdit,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { staffService } from '../../services/staff.service';
import type { LabOrderItem } from '../../types/staff.types';

type OrderStatus = 'PENDING' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export function LabTechPanel() {
  const [orders, setOrders] = useState<LabOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'PENDING_QUEUE' | 'COMPLETED' | 'ALL'>('PENDING_QUEUE');
  const [searchQuery, setSearchQuery] = useState('');

  // Update Modal State
  const [selectedOrder, setSelectedOrder] = useState<LabOrderItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<OrderStatus>('IN_PROGRESS');
  const [result, setResult] = useState('');
  const [instructions, setInstructions] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await staffService.getLabOrders();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investigation orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    staffService
      .getLabOrders()
      .then((data) => {
        if (mounted) {
          setOrders(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load investigation orders.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openUpdateModal = (order: LabOrderItem) => {
    setSelectedOrder(order);
    setStatus(order.status || 'IN_PROGRESS');
    setResult(order.result || '');
    setInstructions(order.instructions || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeUpdateModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };

  const handleUpdateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await staffService.updateLabOrder(selectedOrder.id, {
        status,
        result: result.trim() || null,
        instructions: instructions.trim() || null,
      });

      setSuccessMessage(
        `Updated test "${selectedOrder.test_name}" status to ${status}.`
      );
      closeUpdateModal();
      loadOrders();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update investigation order.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'PENDING_QUEUE') {
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        return false;
      }
    } else if (statusFilter === 'COMPLETED') {
      if (order.status !== 'COMPLETED') {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const testMatch = (order.test_name || '').toLowerCase().includes(q);
      const patientMatch = (order.patient_name || '').toLowerCase().includes(q);
      const docMatch = (order.doctor_name || '').toLowerCase().includes(q);
      return testMatch || patientMatch || docMatch;
    }

    return true;
  });

  const getStatusBadgeVariant = (st: string) => {
    switch (st) {
      case 'PENDING':
        return 'warning';
      case 'SAMPLE_COLLECTED':
        return 'primary';
      case 'IN_PROGRESS':
        return 'primary';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const activeQueueCount = orders.filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
  ).length;

  return (
    <div className="lab-tech-panel">
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadOrders}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" className="mb-4">
          {successMessage}
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="metrics-summary-row mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Card className="summary-stat-card">
          <span className="stat-label">Pending / Processing Orders</span>
          <strong className="stat-value">{activeQueueCount}</strong>
          <span className="stat-hint">Active laboratory tasks</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Diagnostic Laboratory</span>
          <strong className="stat-value text-base">Core Pathology & Diagnostics</strong>
          <span className="stat-hint">Specimen processing & results</span>
        </Card>
      </div>

      {/* Main Orders Card */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              Investigation & Lab Diagnostic Orders
            </h3>
            <p className="text-secondary text-sm" style={{ margin: 0 }}>
              Process tests, record diagnostic findings, and publish laboratory results.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant={statusFilter === 'PENDING_QUEUE' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('PENDING_QUEUE')}
            >
              Active Queue ({activeQueueCount})
            </Button>
            <Button
              variant={statusFilter === 'COMPLETED' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('COMPLETED')}
            >
              Completed Tests
            </Button>
            <Button
              variant={statusFilter === 'ALL' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('ALL')}
            >
              All Orders ({orders.length})
            </Button>
            <Button
              variant="outline"
              onClick={loadOrders}
              loading={loading}
              icon={<RefreshCw size={16} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Search Input */}
        <div style={{ marginBottom: '1rem', maxWidth: '380px' }}>
          <Input
            placeholder="Search by test name, patient, or doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>

        {loading ? (
          <Spinner label="Loading diagnostic orders..." />
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary, #64748b)' }}>
            <Clock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No investigation orders found.</p>
            <p className="text-xs" style={{ margin: '0.25rem 0 0' }}>
              When doctors place lab orders during consultations, they will appear here.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  <th style={{ padding: '0.75rem' }}>Test Name</th>
                  <th style={{ padding: '0.75rem' }}>Patient Name</th>
                  <th style={{ padding: '0.75rem' }}>Ordering Doctor</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Result Summary</th>
                  <th style={{ padding: '0.75rem' }}>Ordered At</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <FlaskConical size={15} color="var(--primary-color, #0284c7)" />
                        {order.test_name}
                      </strong>
                      {order.instructions && (
                        <span className="text-secondary text-xs" style={{ display: 'block', marginTop: '2px' }}>
                          Instructions: {order.instructions}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <strong>{order.patient_name || 'Patient'}</strong>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {order.doctor_name ? `Dr. ${order.doctor_name}` : 'Attending Doctor'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <Badge variant={getStatusBadgeVariant(order.status)} size="sm">
                        {order.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.75rem', maxWidth: '240px' }}>
                      {order.result ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary, #1e293b)' }}>
                          {order.result.length > 50 ? `${order.result.slice(0, 50)}...` : order.result}
                        </span>
                      ) : (
                        <span className="text-secondary text-xs" style={{ fontStyle: 'italic' }}>
                          No result recorded
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
                      {new Date(order.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <Button
                        variant={order.status === 'COMPLETED' ? 'outline' : 'primary'}
                        onClick={() => openUpdateModal(order)}
                        icon={<FileEdit size={14} />}
                      >
                        {order.status === 'COMPLETED' ? 'Edit Result' : 'Process / Result'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Update Result Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeUpdateModal}
        title={`Update Lab Order: ${selectedOrder?.test_name || ''}`}
      >
        <form onSubmit={handleUpdateSubmit}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--surface-subtle, #f8fafc)', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>
              Test: {selectedOrder?.test_name}
            </p>
            <p className="text-xs text-secondary" style={{ margin: 0 }}>
              Patient: <strong>{selectedOrder?.patient_name || 'Patient'}</strong> • Ordering Doctor: <strong>Dr. {selectedOrder?.doctor_name || 'Attending'}</strong>
            </p>
          </div>

          {formError && (
            <Alert type="error" className="mb-4">
              {formError}
            </Alert>
          )}

          <div className="form-field" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Order Processing Status *</label>
            <select
              className="form-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
            >
              <option value="PENDING">PENDING - Awaiting Specimen</option>
              <option value="SAMPLE_COLLECTED">SAMPLE_COLLECTED - Specimen Received</option>
              <option value="IN_PROGRESS">IN_PROGRESS - Analysis in Progress</option>
              <option value="COMPLETED">COMPLETED - Findings Ready</option>
              <option value="CANCELLED">CANCELLED - Order Terminated</option>
            </select>
          </div>

          <div className="form-field" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Test Findings & Diagnostic Results</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="e.g. Hemoglobin: 14.2 g/dL, Platelets: 250,000 /mcL, Normal reference range observed..."
              value={result}
              onChange={(e) => setResult(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div className="form-field" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Technician Comments / Instructions</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Specimen analyzed under standard temperature..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" type="button" onClick={closeUpdateModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} icon={<CheckCircle2 size={16} />}>
              Save Diagnostic Update
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
