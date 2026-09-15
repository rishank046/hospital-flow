// Domain & Clinical Workflow Event Stream
// Strictly isolated to apps/web/src/simulation/components/LogMode/

import { useState } from 'react';
import { Activity, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { SimulationDomainEvent } from '../../engine/simulationTypes';

interface EventLogStreamProps {
  events: SimulationDomainEvent[];
}

export function EventLogStream({ events }: EventLogStreamProps) {
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'info' | 'success' | 'warning' | 'error'>('ALL');

  const filteredEvents = events.filter((e) => {
    if (levelFilter !== 'ALL' && e.level !== levelFilter) {
      return false;
    }
    return true;
  });

  const getLevelIcon = (level: SimulationDomainEvent['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 size={16} color="#34d399" />;
      case 'warning':
        return <AlertTriangle size={16} color="#fbbf24" />;
      case 'error':
        return <XCircle size={16} color="#f87171" />;
      default:
        return <Info size={16} color="#38bdf8" />;
    }
  };

  const getLevelBadgeClass = (level: SimulationDomainEvent['level']) => {
    switch (level) {
      case 'success': return 'sim-badge-success';
      case 'warning': return 'sim-badge-warning';
      case 'error': return 'sim-badge-danger';
      default: return 'sim-badge-info';
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--sim-card-bg)', border: '1px solid var(--sim-card-border)', borderRadius: '8px', padding: '1.25rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="var(--sim-primary)" />
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffffff' }}>
            Clinical & Workflow Event Stream ({filteredEvents.length})
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ALL', 'info', 'success', 'warning', 'error'] as const).map((lvl) => (
            <button
              key={lvl}
              className={`sim-btn ${levelFilter === lvl ? 'sim-btn-primary' : 'sim-btn-outline'}`}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', textTransform: 'capitalize' }}
              onClick={() => setLevelFilter(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--sim-text-muted)', fontSize: '0.85rem' }}>
            No domain events matching filter.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                backgroundColor: '#0f172a',
                border: '1px solid var(--sim-card-border)',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ marginTop: '2px' }}>{getLevelIcon(evt.level)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className={`sim-badge ${getLevelBadgeClass(evt.level)}`}>
                      {evt.type}
                    </span>
                    <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>{evt.actorName}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sim-text-muted)' }}>({evt.actorRole})</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--sim-text-muted)', fontFamily: 'monospace' }}>
                    {evt.timestamp}
                  </span>
                </div>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>
                  {evt.message}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
