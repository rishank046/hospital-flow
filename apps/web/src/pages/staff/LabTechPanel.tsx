import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  FlaskConical,
  CheckCircle2,
  RefreshCw,
  Search,
  FileEdit,
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

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const collectedCount = orders.filter((o) => o.status === 'SAMPLE_COLLECTED').length;
  const inProgressCount = orders.filter((o) => o.status === 'IN_PROGRESS').length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
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
        <Alert type="success" className="mb-4" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Workspace Header */}
      <div className="station-header">
        <div className="station-header-info">
          <h3>
            <FlaskConical size={20} aria-hidden="true" />
            Diagnostic Laboratory Bench
          </h3>
          <p>Specimen collection, diagnostic test processing, and clinical report publication</p>
        </div>

        <div className="station-header-actions">
          <Button
            variant="outline"
            onClick={loadOrders}
            loading={loading}
            icon={<RefreshCw size={16} />}
          >
            Refresh Worklist
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards (Section 12) */}
      <div className="metrics-summary-row mb-6">
        <Card className="summary-stat-card">
          <span className="stat-label">Orders Pending</span>
          <strong className="stat-value">{pendingCount}</strong>
          <span className="stat-hint">Awaiting specimen collection</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Samples Collected</span>
          <strong className="stat-value">{collectedCount}</strong>
          <span className="stat-hint">Specimens logged at bench</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Processing / Active</span>
          <strong className="stat-value">{inProgressCount}</strong>
          <span className="stat-hint">Tests currently undergoing analysis</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Reports Completed</span>
          <strong className="stat-value">{completedCount}</strong>
          <span className="stat-hint">Results published to clinical chart</span>
        </Card>
      </div>

      {/* Main Orders Card */}
      <Card>
        <div className="station-header" style={{ marginBottom: '14px' }}>
          <div className="station-header-info">
            <h3 style={{ fontSize: '18px' }}>
              Laboratory Orders Worklist ({filteredOrders.length})
            </h3>
            <p>Process investigations and record verified findings</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="station-filter-bar">
          <div className="station-search-box">
            <Input
              placeholder="Search by test name, patient, or doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Laboratory order status filter">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'PENDING_QUEUE'}
              className={`filter-tab-btn ${statusFilter === 'PENDING_QUEUE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING_QUEUE')}
            >
              Active Queue ({activeQueueCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'COMPLETED'}
              className={`filter-tab-btn ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('COMPLETED')}
            >
              Completed ({completedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'ALL'}
              className={`filter-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Orders ({orders.length})
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading diagnostic orders..." />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No laboratory orders found"
            description="No lab orders match the selected filter. Test orders placed by physicians will appear here automatically."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Patient Name</th>
                  <th>Ordering Doctor</th>
                  <th>Status</th>
                  <th>Result Summary</th>
                  <th>Ordered At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <FlaskConical size={15} color="#165b53" aria-hidden="true" />
                        {order.test_name}
                      </strong>
                      {order.instructions && (
                        <span className="cell-meta" style={{ display: 'block', marginTop: '2px' }}>
                          Instructions: {order.instructions}
                        </span>
                      )}
                    </td>
                    <td className="cell-name">{order.patient_name || 'Patient'}</td>
                    <td className="cell-meta">
                      {order.doctor_name ? `Dr. ${order.doctor_name}` : 'Attending Doctor'}
                    </td>
                    <td>
                      <Badge variant={getStatusBadgeVariant(order.status)} size="sm">
                        {order.status}
                      </Badge>
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      {order.result ? (
                        <span className="cell-meta" style={{ color: 'var(--ink)' }}>
                          {order.result.length > 50 ? `${order.result.slice(0, 50)}...` : order.result}
                        </span>
                      ) : (
                        <span className="cell-meta" style={{ fontStyle: 'italic' }}>
                          No result recorded
                        </span>
                      )}
                    </td>
                    <td className="cell-meta">
                      {new Date(order.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="cell-actions">
                      <Button
                        variant={order.status === 'COMPLETED' ? 'outline' : 'primary'}
                        size="sm"
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
