import type { ElementType, MouseEvent } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Activity,
  FileText,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps = {}) {
  const { role } = useAuth();
  const currentPath = window.location.pathname;

  const patientNav: NavItem[] = [
    { label: 'Dashboard', href: '/patient', icon: LayoutDashboard },
    { label: 'Appointments', href: '/patient/appointments', icon: Calendar },
    { label: 'Care Journey', href: '/patient/journey', icon: Activity },
    { label: 'Medical Records', href: '/patient/records', icon: FileText },
    { label: 'Profile Settings', href: '/patient/profile', icon: User },
  ];

  const doctorNav: NavItem[] = [
    { label: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
    { label: 'Daily Schedule', href: '/doctor/schedule', icon: Calendar },
    { label: 'Assigned Patients', href: '/doctor/patients', icon: Users },
  ];

  const navItems = role === 'DOCTOR' ? doctorNav : patientNav;

  const navigate = (href: string, e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClose) {
      onClose();
    }
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Portal Navigation">
      <div className="sidebar-section-title">
        {role === 'DOCTOR' ? 'Doctor Workspace' : 'Patient Workspace'}
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive =
            currentPath === item.href ||
            (item.href !== '/patient' &&
              item.href !== '/doctor' &&
              currentPath.startsWith(item.href));
          const IconComponent = item.icon;

          return (
            <a
              key={item.href}
              href={item.href}
              className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
              onClick={(e) => navigate(item.href, e)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                <IconComponent size={16} aria-hidden="true" />
              </span>
              <span className="sidebar-link-label">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
