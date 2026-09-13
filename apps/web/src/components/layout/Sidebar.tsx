import type { MouseEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export function Sidebar() {
  const { role } = useAuth();
  const currentPath = window.location.pathname;

  const patientNav: NavItem[] = [
    { label: 'Dashboard', href: '/patient', icon: '⊞' },
    { label: 'Appointments', href: '/patient/appointments', icon: '◷' },
    { label: 'Care Journey', href: '/patient/journey', icon: '⤳' },
    { label: 'Medical Records', href: '/patient/records', icon: '≡' },
    { label: 'Profile Settings', href: '/patient/profile', icon: '◎' },
  ];

  const doctorNav: NavItem[] = [
    { label: 'Dashboard', href: '/doctor', icon: '⊞' },
    { label: 'Daily Schedule', href: '/doctor/schedule', icon: '◷' },
    { label: 'Assigned Patients', href: '/doctor/patients', icon: '◈' },
  ];

  const staffNav: NavItem[] = [
    { label: 'Staff Portal', href: '/staff', icon: '⊞' },
  ];

  const navItems = role === 'DOCTOR' ? doctorNav : role === 'STAFF' ? staffNav : patientNav;

  const navigate = (href: string, e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <aside className="app-sidebar" aria-label="Portal Navigation">
      <div className="sidebar-section-title">
        {role === 'DOCTOR' ? 'Doctor Workspace' : role === 'STAFF' ? 'Staff Workspace' : 'Patient Workspace'}
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive =
            currentPath === item.href ||
            (item.href !== '/patient' &&
              item.href !== '/doctor' &&
              currentPath.startsWith(item.href));

          return (
            <a
              key={item.href}
              href={item.href}
              className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
              onClick={(e) => navigate(item.href, e)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sidebar-link-label">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
