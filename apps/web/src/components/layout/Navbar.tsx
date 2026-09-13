import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../common/Badge';

export function Navbar() {
  const { user, role, logout } = useAuth();
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const displayName = user?.name || (role === 'DOCTOR' ? 'Doctor' : 'Patient');

  return (
    <header className="app-navbar">
      <div className="navbar-brand">
        <a href={role === 'DOCTOR' ? '/doctor' : '/patient'} className="brand-link">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="brand-title">MediQ</span>
        </a>

        <span className="live-status-pill">
          <i />
          {time.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      </div>

      <div className="navbar-actions">
        <div className="user-profile-info">
          <span className="user-greeting">Welcome, <strong>{displayName}</strong></span>
          <Badge variant={role === 'DOCTOR' ? 'primary' : 'success'} size="sm">
            {role ?? 'USER'}
          </Badge>
        </div>

        <button
          type="button"
          className="navbar-logout-btn"
          onClick={() => void logout()}
          aria-label="Sign out"
        >
          Sign out <span>→</span>
        </button>
      </div>
    </header>
  );
}
