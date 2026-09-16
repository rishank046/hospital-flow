import { useEffect, useState } from 'react';
import {
  Receipt,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { request } from '../../services/api.client';

interface InvoiceItem {
  id: string;
  visit_id?: string;
  patient_id?: string;
  patient_name?: string;
  amount: number | string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  created_at: string;
}

export function BillingClerkPanel() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'PAID' | 'ALL'>('PENDING');

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await request<{ invoices?: InvoiceItem[] } | InvoiceItem[]>('/invoices');
      if (Array.isArray(res)) {
        setInvoices(res);
      } else {
        setInvoices(res.invoices || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    request<{ invoices?: InvoiceItem[] } | InvoiceItem[]>('/invoices')
      .then((res) => {
        if (mounted) {
          if (Array.isArray(res)) {
            setInvoices(res);
          } else {
            setInvoices(res.invoices || []);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load invoices.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const idMatch = inv.id.toLowerCase().includes(q);
      const patMatch = (inv.patient_name || '').toLowerCase().includes(q);
      return idMatch || patMatch;
    }
    return true;
  });

  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;
  const paidCount = invoices.filter((i) => i.status === 'PAID').length;
  const pendingAmount = invoices
    .filter((i) => i.status === 'PENDING')
    .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  return (
    <div className="billing-clerk-panel">
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadInvoices}>
          {error}
        </Alert>
      )}

      {/* Workspace Header */}
      <div className="station-header">
        <div className="station-header-info">
          <h3>
            <Receipt size={20} aria-hidden="true" />
            Hospital Billing & Cash Counter
          </h3>
          <p>Process invoice settlements, collect cashier payments, and audit patient billing accounts</p>
        </div>

        <div className="station-header-actions">
          <Button
            variant="outline"
            onClick={loadInvoices}
            loading={loading}
            icon={<RefreshCw size={16} />}
          >
            Refresh Ledger
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards (Section 12) */}
      <div className="metrics-summary-row mb-6">
        <Card className="summary-stat-card">
          <span className="stat-label">Pending Invoices</span>
          <strong className="stat-value">{pendingCount}</strong>
          <span className="stat-hint">Awaiting cashier payment settlement</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Settled Invoices</span>
          <strong className="stat-value">{paidCount}</strong>
          <span className="stat-hint">Successfully paid balances</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Outstanding Balance</span>
          <strong className="stat-value text-base">${pendingAmount.toFixed(2)}</strong>
          <span className="stat-hint">Total uncollected patient receivables</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Total Invoices</span>
          <strong className="stat-value">{invoices.length}</strong>
          <span className="stat-hint">Full billing ledger records</span>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <div className="station-header" style={{ marginBottom: '14px' }}>
          <div className="station-header-info">
            <h3 style={{ fontSize: '18px' }}>
              Billing Register & Invoices ({filteredInvoices.length})
            </h3>
            <p>Review invoice items and payment statuses</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="station-filter-bar">
          <div className="station-search-box">
            <Input
              placeholder="Search invoice ID or patient name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Invoice filter tabs">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'PENDING'}
              className={`filter-tab-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'PAID'}
              className={`filter-tab-btn ${statusFilter === 'PAID' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PAID')}
            >
              Paid ({paidCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'ALL'}
              className={`filter-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Invoices ({invoices.length})
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading billing records..." />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description="No invoices match the selected filter. Invoices generated for consultations, tests, and medications will appear here."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Patient Name</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="cell-id">{inv.id.slice(0, 8)}</td>
                    <td className="cell-name">{inv.patient_name || 'Patient'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      ${Number(inv.amount || 0).toFixed(2)}
                    </td>
                    <td>
                      <Badge
                        variant={inv.status === 'PENDING' ? 'warning' : inv.status === 'PAID' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="cell-meta">
                      {new Date(inv.created_at).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

