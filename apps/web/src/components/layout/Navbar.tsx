import { useEffect, useState, type MouseEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../common/Badge';

export interface NavbarProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function Navbar({ isSidebarOpen = false, onToggleSidebar }: NavbarProps = {}) {
  const { user, role, staffRole, logout } = useAuth();
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isDoctor = role === 'DOCTOR' || (role === 'STAFF' && staffRole === 'DOCTOR');
  const isAdmin = role === 'ADMIN';
  const isStaff = role === 'STAFF' && !isDoctor;

  const displayName =
    user?.name ||
    (isDoctor
      ? 'Doctor'
      : isAdmin
      ? 'Admin'
      : isStaff
      ? 'Staff'
      : 'User');

  let homeHref = '/user/dashboard';
  if (isAdmin) {
    homeHref = '/admin/dashboard';
  } else if (isDoctor) {
    homeHref = '/staff/doctor/dashboard';
  } else if (isStaff) {
    switch (staffRole) {
      case 'OPD_MANAGER':
      case 'RECEPTIONIST':
        homeHref = '/staff/opd';
        break;
      case 'LAB_TECH':
      case 'LAB_STAFF':
        homeHref = '/staff/lab';
        break;
      case 'PHARMACIST':
        homeHref = '/staff/pharmacy';
        break;
      case 'BILLING_CLERK':
        homeHref = '/staff/billing';
        break;
      case 'NURSE':
        homeHref = '/staff/nurse';
        break;
      default:
        homeHref = '/staff/opd';
        break;
    }
  }

  const navigateToHome = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (window.location.pathname !== homeHref) {
      window.history.pushState({}, '', homeHref);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <header className="app-navbar">
      <div className="navbar-brand">
        {onToggleSidebar && (
          <button
            type="button"
            className="hamburger-toggle"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            aria-expanded={isSidebarOpen}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        )}
        <a href={homeHref} onClick={navigateToHome} className="brand-link">
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
          <Badge variant={isDoctor ? 'primary' : isAdmin ? 'warning' : isStaff ? 'primary' : 'success'} size="sm">
            {staffRole || role || 'USER'}
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
