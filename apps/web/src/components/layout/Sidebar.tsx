import type { ElementType, MouseEvent } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Activity,
  FileText,
  User,
  Users,
  Shield,
  UserCheck,
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
  const { role, staffRole } = useAuth();
  const currentPath = window.location.pathname;

  const isDoctor = role === 'DOCTOR' || (role === 'STAFF' && staffRole === 'DOCTOR');
  const isStaff = role === 'STAFF' && !isDoctor;
  const isAdmin = role === 'ADMIN';

  const patientNav: NavItem[] = [
    { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
    { label: 'Appointments', href: '/patient/appointments', icon: Calendar },
    { label: 'Care Journey', href: '/patient/journey', icon: Activity },
    { label: 'Medical Records', href: '/patient/records', icon: FileText },
    { label: 'Profile Settings', href: '/patient/profile', icon: User },
  ];

  const doctorNav: NavItem[] = [
    { label: 'Dashboard', href: '/doctor/dashboard', icon: LayoutDashboard },
    { label: 'Daily Schedule', href: '/doctor/schedule', icon: Calendar },
    { label: 'Assigned Patients', href: '/doctor/patients', icon: Users },
  ];

  let staffLabel = 'Staff Portal';
  if (staffRole === 'RECEPTIONIST') staffLabel = 'Reception & Intake';
  else if (staffRole === 'NURSE') staffLabel = 'Nurse Triage Station';
  else if (staffRole === 'PHARMACIST') staffLabel = 'Pharmacy Dispensing';
  else if (staffRole === 'LAB_TECH' || staffRole === 'LAB_STAFF') staffLabel = 'Diagnostic Lab';
  else if (staffRole === 'BILLING_CLERK') staffLabel = 'Billing & Accounts';

  const staffNav: NavItem[] = [
    { label: staffLabel, href: '/staff/dashboard', icon: LayoutDashboard },
  ];

  const adminNav: NavItem[] = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Staff Management', href: '/admin/staff', icon: Shield },
    { label: 'Doctor Directory', href: '/admin/doctors', icon: UserCheck },
    { label: 'Patient Registry', href: '/admin/patients', icon: User },
  ];

  const navItems = isDoctor ? doctorNav : isStaff ? staffNav : isAdmin ? adminNav : patientNav;

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
        {isDoctor ? 'Doctor Workspace' : isStaff ? 'Staff Workspace' : isAdmin ? 'Admin Workspace' : 'Patient Workspace'}
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive =
            currentPath === item.href ||
            (item.href !== '/patient/dashboard' &&
              item.href !== '/doctor/dashboard' &&
              item.href !== '/staff/dashboard' &&
              item.href !== '/admin/dashboard' &&
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
