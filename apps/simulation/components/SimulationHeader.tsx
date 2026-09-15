// Simulation Top Navigation & Global Control Header
// Strictly isolated to apps/web/src/simulation/components/

import { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Copy,
  Check,
  Activity,
  Terminal,
  Settings,
  Map,
} from 'lucide-react';
import type { SimulationDisplayMode, SimulationState } from '../engine/simulationTypes';

interface SimulationHeaderProps {
  state: SimulationState;
  displayMode: SimulationDisplayMode;
  onModeChange: (mode: SimulationDisplayMode) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  onOpenAdminModal: () => void;
}

export function SimulationHeader({
  state,
  displayMode,
  onModeChange,
  onStart,
  onPause,
  onResume,
  onReset,
  onStep,
  onSpeedChange,
  onOpenAdminModal,
}: SimulationHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRunId = () => {
    navigator.clipboard.writeText(state.runId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatClock = (totalSec: number): string => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (state.status) {
      case 'RUNNING':
        return <span className="sim-badge sim-badge-success">● RUNNING</span>;
      case 'BOOTSTRAPPING':
        return <span className="sim-badge sim-badge-warning">⟳ BOOTSTRAPPING</span>;
      case 'PAUSED':
        return <span className="sim-badge sim-badge-warning">❚❚ PAUSED</span>;
      case 'COMPLETED':
        return <span className="sim-badge sim-badge-info">✓ COMPLETED</span>;
      case 'ERROR':
        return <span className="sim-badge sim-badge-danger">⚠ ERROR</span>;
      default:
        return <span className="sim-badge sim-badge-neutral">IDLE</span>;
    }
  };

  return (
    <header className="sim-header">
      <div className="sim-header-brand">
        <span className="sim-logo-badge">MediQ SIM</span>
        <div>
          <h1 className="sim-header-title">Hospital Flow Simulator</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            <span className="sim-run-id-pill" title="Unique Simulation Run ID">
              Run: {state.runId}
              <button
                onClick={handleCopyRunId}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                title="Copy Run ID"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </span>
            {getStatusBadge()}
          </div>
        </div>
      </div>

      <div className="sim-header-controls">
        {/* Clock */}
        <div className="sim-clock-display" title="Simulated Shift Time">
          <span>TIME:</span>
          <span>{formatClock(state.elapsedSec)}</span>
        </div>

        {/* Speed Selector */}
        <div className="sim-speed-selector" title="Simulation Speed Multiplier">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              className={`sim-speed-btn ${state.speed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Playback Controls */}
        {state.status === 'RUNNING' ? (
          <button className="sim-btn sim-btn-warning" onClick={onPause} title="Pause Simulation">
            <Pause size={16} />
            Pause
          </button>
        ) : state.status === 'PAUSED' ? (
          <button className="sim-btn sim-btn-success" onClick={onResume} title="Resume Simulation">
            <Play size={16} />
            Resume
          </button>
        ) : (
          <button
            className="sim-btn sim-btn-primary"
            onClick={onStart}
            disabled={state.status === 'BOOTSTRAPPING'}
            title="Start Simulation Run"
          >
            <Play size={16} />
            {state.status === 'BOOTSTRAPPING' ? 'Bootstrapping...' : 'Start Run'}
          </button>
        )}

        <button
          className="sim-btn sim-btn-outline"
          onClick={onStep}
          disabled={state.status !== 'PAUSED' && state.status !== 'IDLE'}
          title="Step forward 2 simulated seconds"
        >
          <FastForward size={16} />
          Step
        </button>

        <button
          className="sim-btn sim-btn-outline"
          onClick={onReset}
          title="Reset Simulation (Generates fresh Run ID)"
        >
          <RotateCcw size={16} />
          Reset
        </button>

        {/* Admin Setup Modal trigger */}
        <button
          className="sim-btn sim-btn-outline"
          onClick={onOpenAdminModal}
          title="Configure Admin Bootstrapping Credentials"
        >
          <Settings size={16} />
          Admin Setup
        </button>

        {/* Display Mode Switcher */}
        <div style={{ display: 'flex', border: '1px solid var(--sim-card-border)', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            className={`sim-speed-btn ${displayMode === 'MAP' ? 'active' : ''}`}
            onClick={() => onModeChange('MAP')}
            style={{ padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Map size={14} />
            2D Map Mode
          </button>
          <button
            className={`sim-speed-btn ${displayMode === 'GUI' ? 'active' : ''}`}
            onClick={() => onModeChange('GUI')}
            style={{ padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Activity size={14} />
            GUI Dashboard
          </button>
          <button
            className={`sim-speed-btn ${displayMode === 'LOG' ? 'active' : ''}`}
            onClick={() => onModeChange('LOG')}
            style={{ padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Terminal size={14} />
            Log Mode
          </button>
        </div>
      </div>
    </header>
  );
}
