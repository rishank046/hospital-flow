// Optional Admin Credentials / Token Provisioning Modal
// Strictly isolated to apps/web/src/simulation/components/

import { useState } from 'react';
import { Shield, Check, Info } from 'lucide-react';

interface AdminProvisioningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (creds: { email?: string; password?: string; token?: string } | null) => void;
  initialCreds: { email?: string; password?: string; token?: string } | null;
}

export function AdminProvisioningModal({
  isOpen,
  onClose,
  onSave,
  initialCreds,
}: AdminProvisioningModalProps) {
  const [authMode, setAuthMode] = useState<'token' | 'login'>(initialCreds?.token ? 'token' : 'login');
  const [adminToken, setAdminToken] = useState(initialCreds?.token || '');
  const [adminEmail, setAdminEmail] = useState(initialCreds?.email || '');
  const [adminPassword, setAdminPassword] = useState(initialCreds?.password || '');

  if (!isOpen) return null;

  const handleSave = () => {
    if (authMode === 'token' && adminToken.trim()) {
      onSave({ token: adminToken.trim() });
    } else if (authMode === 'login' && adminEmail.trim() && adminPassword.trim()) {
      onSave({ email: adminEmail.trim(), password: adminPassword.trim() });
    } else {
      onSave(null);
    }
    onClose();
  };

  const handleClear = () => {
    setAdminToken('');
    setAdminEmail('');
    setAdminPassword('');
    onSave(null);
    onClose();
  };

  return (
    <div className="sim-modal-overlay">
      <div className="sim-modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} color="var(--sim-primary)" />
            Admin Provisioning Setup
          </h3>
          <button
            className="sim-btn sim-btn-outline"
            style={{ padding: '0.2rem 0.5rem' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#bae6fd', display: 'flex', gap: '0.5rem' }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Optional Real Staff Provisioning:</strong> Providing an Admin token or login allows the simulator to call the real <code>POST /admin/doctors</code> and <code>POST /admin/staff</code> endpoints to dynamically create fresh doctors, pharmacists, and lab techs for the simulation run.
            <br />
            If left empty, the simulation creates online patient users and simulates hospital flow using existing registered staff.
          </div>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={`sim-btn ${authMode === 'login' ? 'sim-btn-primary' : 'sim-btn-outline'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setAuthMode('login')}
          >
            Admin Credentials
          </button>
          <button
            className={`sim-btn ${authMode === 'token' ? 'sim-btn-primary' : 'sim-btn-outline'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setAuthMode('token')}
          >
            Direct Admin JWT
          </button>
        </div>

        {authMode === 'login' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--sim-text-muted)', marginBottom: '0.25rem' }}>
                Admin Email
              </label>
              <input
                type="email"
                className="sim-input"
                style={{ width: '100%' }}
                placeholder="e.g. admin@hospital.org"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--sim-text-muted)', marginBottom: '0.25rem' }}>
                Admin Password
              </label>
              <input
                type="password"
                className="sim-input"
                style={{ width: '100%' }}
                placeholder="••••••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--sim-text-muted)', marginBottom: '0.25rem' }}>
              Admin Bearer Token (JWT)
            </label>
            <textarea
              className="sim-input"
              style={{ width: '100%', height: '85px', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="sim-btn sim-btn-outline" onClick={handleClear} style={{ color: '#f87171' }}>
            Clear Credentials
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="sim-btn sim-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button className="sim-btn sim-btn-primary" onClick={handleSave}>
              <Check size={16} />
              Save Setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
