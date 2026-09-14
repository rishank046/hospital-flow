import { useEffect, useState } from 'react';
import {
  RefreshCw,
  Search,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
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
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING');

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
    if (statusFilter === 'PENDING' && inv.status !== 'PENDING') {
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

      {/* Metrics */}
      <div className="metrics-summary-row mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Card className="summary-stat-card">
          <span className="stat-label">Pending Invoices</span>
          <strong className="stat-value">{pendingCount}</strong>
          <span className="stat-hint">Invoices awaiting settlement</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Pending Total Amount</span>
          <strong className="stat-value text-base">${pendingAmount.toFixed(2)}</strong>
          <span className="stat-hint">Uncollected patient balances</span>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              Hospital Billing & Invoices
            </h3>
            <p className="text-secondary text-sm" style={{ margin: 0 }}>
              Process invoice settlements and review patient billing accounts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant={statusFilter === 'PENDING' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending ({pendingCount})
            </Button>
            <Button
              variant={statusFilter === 'ALL' ? 'primary' : 'outline'}
              onClick={() => setStatusFilter('ALL')}
            >
              All Invoices ({invoices.length})
            </Button>
            <Button
              variant="outline"
              onClick={loadInvoices}
              loading={loading}
              icon={<RefreshCw size={16} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem', maxWidth: '380px' }}>
          <Input
            placeholder="Search invoice or patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>

        {loading ? (
          <Spinner label="Loading billing data..." />
        ) : filteredInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary, #64748b)' }}>
            <Clock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No invoices found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  <th style={{ padding: '0.75rem' }}>Invoice ID</th>
                  <th style={{ padding: '0.75rem' }}>Amount</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                  >
                    <td style={{ padding: '0.75rem' }}>
                      <code style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {inv.id.slice(0, 8)}
                      </code>
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                      ${Number(inv.amount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <Badge
                        variant={inv.status === 'PENDING' ? 'warning' : 'success'}
                        size="sm"
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
                      {new Date(inv.created_at).toLocaleDateString()}
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
