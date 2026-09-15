// Scenario Configuration Selector & Workload Adjuster
// Strictly isolated to apps/web/src/simulation/components/

import { useState } from 'react';
import { Layers, FileCode, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  PRESET_SCENARIOS,
  validateScenarioConfig,
  type ScenarioConfig,
} from '../engine/scenarioConfig';

interface ScenarioControlsProps {
  currentScenario: ScenarioConfig;
  onSelectScenario: (scenario: ScenarioConfig) => void;
  isRunning: boolean;
}

export function ScenarioControls({
  currentScenario,
  onSelectScenario,
  isRunning,
}: ScenarioControlsProps) {
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleOpenJson = () => {
    setJsonText(JSON.stringify(currentScenario, null, 2));
    setJsonError(null);
    setShowJsonModal(true);
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as ScenarioConfig;
      // Strict security validation: must not contain any credentials
      validateScenarioConfig(parsed);
      onSelectScenario(parsed);
      setShowJsonModal(false);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--sim-card-bg)', border: '1px solid var(--sim-card-border)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Layers size={20} color="var(--sim-primary)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
              Workload Scenario: {currentScenario.name}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sim-text-muted)' }}>
              {currentScenario.description}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Preset Buttons */}
          {PRESET_SCENARIOS.map((preset) => (
            <button
              key={preset.id}
              className={`sim-btn ${preset.id === currentScenario.id ? 'sim-btn-primary' : 'sim-btn-outline'}`}
              onClick={() => onSelectScenario(preset)}
              disabled={isRunning}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              {preset.name}
            </button>
          ))}

          <button
            className="sim-btn sim-btn-outline"
            onClick={handleOpenJson}
            disabled={isRunning}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            title="Inspect or customize workload JSON schema"
          >
            <FileCode size={14} />
            Scenario JSON
          </button>
        </div>
      </div>

      {/* Workload Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--sim-card-border)' }}>
        <div style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--sim-text-muted)' }}>Walk-in Load: </span>
          <strong style={{ color: '#ffffff' }}>{currentScenario.workload.numWalkIns} patients</strong>
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--sim-text-muted)' }}>Online Appointments: </span>
          <strong style={{ color: '#ffffff' }}>{currentScenario.workload.numAppointments} patients</strong>
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--sim-text-muted)' }}>Lab Test Rate: </span>
          <strong style={{ color: '#ffffff' }}>{Math.round(currentScenario.probabilities.orderLabTestProbability * 100)}%</strong>
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--sim-text-muted)' }}>Prescription Rate: </span>
          <strong style={{ color: '#ffffff' }}>{Math.round(currentScenario.probabilities.prescriptionProbability * 100)}%</strong>
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--sim-text-muted)' }}>Cash vs Online: </span>
          <strong style={{ color: '#ffffff' }}>{Math.round(currentScenario.probabilities.cashPaymentProbability * 100)}% cash</strong>
        </div>
      </div>

      {/* Scenario JSON Modal */}
      {showJsonModal && (
        <div className="sim-modal-overlay">
          <div className="sim-modal-card" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileCode size={20} color="var(--sim-primary)" />
                Scenario Workload Configuration
              </h3>
              <button
                className="sim-btn sim-btn-outline"
                style={{ padding: '0.2rem 0.5rem' }}
                onClick={() => setShowJsonModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--sim-text-muted)', marginBottom: '0.75rem' }}>
              Define workload rates, arrival intervals, and clinical branching probabilities.
              <br />
              <strong style={{ color: '#f87171' }}>Security Warning:</strong> Scenario JSON must NEVER contain real passwords, emails, or tokens.
            </p>

            {jsonError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} />
                {jsonError}
              </div>
            )}

            <textarea
              className="sim-input"
              style={{ width: '100%', height: '240px', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical', marginBottom: '1rem' }}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="sim-btn sim-btn-outline" onClick={() => setShowJsonModal(false)}>
                Cancel
              </button>
              <button className="sim-btn sim-btn-primary" onClick={handleApplyJson}>
                <CheckCircle2 size={16} />
                Apply Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
