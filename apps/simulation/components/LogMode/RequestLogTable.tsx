// Technical HTTP Request Log Viewer with Automatic Security Redaction
// Strictly isolated to apps/web/src/simulation/components/LogMode/

import { useState } from 'react';
import { Download, Trash2, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import type { SimulationHttpRequestLog } from '../../api/simulation.api.types';

interface RequestLogTableProps {
  logs: SimulationHttpRequestLog[];
  onClearLogs?: () => void;
}

export function RequestLogTable({ logs, onClearLogs }: RequestLogTableProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (roleFilter !== 'ALL' && log.actorRole !== roleFilter) {
      return false;
    }
    if (statusFilter === '2XX' && (log.status < 200 || log.status >= 300)) {
      return false;
    }
    if (statusFilter === 'ERRORS' && (log.status >= 200 && log.status < 400)) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const endpointMatch = log.endpoint.toLowerCase().includes(q);
      const actorMatch = log.actorName.toLowerCase().includes(q) || log.actorRole.toLowerCase().includes(q);
      const eventMatch = (log.workflowEvent || '').toLowerCase().includes(q);
      return endpointMatch || actorMatch || eventMatch;
    }
    return true;
  });

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'GET': return 'sim-badge-info';
      case 'POST': return 'sim-badge-success';
      case 'PATCH': return 'sim-badge-warning';
      case 'DELETE': return 'sim-badge-danger';
      default: return 'sim-badge-neutral';
    }
  };

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return <span className="sim-badge sim-badge-success">{status}</span>;
    }
    if (status >= 400 && status < 500) {
      return <span className="sim-badge sim-badge-warning">{status}</span>;
    }
    if (status >= 500 || status === 0) {
      return <span className="sim-badge sim-badge-danger">{status === 0 ? 'NET_ERR' : status}</span>;
    }
    return <span className="sim-badge sim-badge-neutral">{status}</span>;
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `simulation-http-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="sim-log-table-container">
      {/* Toolbar */}
      <div className="sim-log-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="sim-input"
              style={{ width: '260px' }}
              placeholder="Filter endpoint, actor, event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="sim-input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All Actors</option>
            <option value="DOCTOR">DOCTOR</option>
            <option value="OPD_MANAGER">OPD_MANAGER</option>
            <option value="LAB_TECH">LAB_TECH</option>
            <option value="PHARMACIST">PHARMACIST</option>
            <option value="BILLING_CLERK">BILLING_CLERK</option>
            <option value="ONLINE_USER">ONLINE_USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <select
            className="sim-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All HTTP Statuses</option>
            <option value="2XX">2xx Success</option>
            <option value="ERRORS">4xx / 5xx / Failures</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.5rem' }}>
            <ShieldCheck size={14} />
            Security Redaction Active (passwords & JWTs hidden)
          </span>

          <button
            className="sim-btn sim-btn-outline"
            onClick={handleExportJson}
            disabled={logs.length === 0}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            title="Download Redacted HTTP Logs as JSON"
          >
            <Download size={14} />
            Export
          </button>

          {onClearLogs && (
            <button
              className="sim-btn sim-btn-outline"
              onClick={onClearLogs}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              title="Clear Log View"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--sim-text-muted)', fontSize: '0.85rem' }}>
            No HTTP activity recorded yet. Start or step the simulation run to generate traffic.
          </div>
        ) : (
          <table className="sim-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}></th>
                <th style={{ width: '100px' }}>Time</th>
                <th style={{ width: '160px' }}>Actor</th>
                <th style={{ width: '80px' }}>Method</th>
                <th>Endpoint</th>
                <th style={{ width: '90px' }}>Status</th>
                <th style={{ width: '80px' }}>Latency</th>
                <th>Workflow Event</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                    <td style={{ textAlign: 'center', padding: '0.4rem' }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td style={{ color: 'var(--sim-text-muted)' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{log.actorName}</div>
                      <span className="sim-badge sim-badge-neutral" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                        {log.actorRole}
                      </span>
                    </td>
                    <td>
                      <span className={`sim-badge ${getMethodBadgeClass(log.method)}`}>
                        {log.method}
                      </span>
                    </td>
                    <td>
                      <code style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{log.endpoint}</code>
                    </td>
                    <td>{getStatusBadge(log.status)}</td>
                    <td style={{ color: log.durationMs > 500 ? '#fbbf24' : 'var(--sim-text-muted)' }}>
                      {log.durationMs} ms
                    </td>
                    <td>
                      <span style={{ color: '#38bdf8', fontSize: '0.8rem' }}>
                        {log.workflowEvent || '—'}
                      </span>
                      {log.error && (
                        <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          {log.error}
                        </div>
                      )}
                      {isExpanded && log.redactedSummary && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid var(--sim-card-border)', borderRadius: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                            Redacted Payload Summary:
                          </span>
                          <pre style={{ margin: 0, fontSize: '0.75rem', color: '#34d399', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {log.redactedSummary}
                          </pre>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
