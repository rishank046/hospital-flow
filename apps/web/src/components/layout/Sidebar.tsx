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
  FlaskConical,
  Pill,
  Heart,
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

  const userNav: NavItem[] = [
    { label: 'Dashboard', href: '/user/dashboard', icon: LayoutDashboard },
    { label: 'Appointments', href: '/user/appointments', icon: Calendar },
    { label: 'Care Journey', href: '/user/journey', icon: Activity },
    { label: 'Medical Records', href: '/user/records', icon: FileText },
    { label: 'Profile Settings', href: '/user/profile', icon: User },
  ];

  const doctorNav: NavItem[] = [
    { label: 'Dashboard', href: '/staff/doctor/dashboard', icon: LayoutDashboard },
    { label: 'Daily Schedule', href: '/staff/doctor/schedule', icon: Calendar },
    { label: 'Assigned Patients', href: '/staff/doctor/patients', icon: Users },
  ];

  let staffNav: NavItem[] = [];
  if (staffRole === 'RECEPTIONIST') {
    staffNav = [
      { label: 'Reception & Intake', href: '/staff/opd', icon: LayoutDashboard },
    ];
  } else if (staffRole === 'OPD_MANAGER') {
    staffNav = [
      { label: 'OPD Management', href: '/staff/opd', icon: LayoutDashboard },
    ];
  } else if (staffRole === 'NURSE') {
    staffNav = [
      { label: 'Nurse Station', href: '/staff/nurse', icon: Heart },
    ];
  } else if (staffRole === 'PHARMACIST') {
    staffNav = [
      { label: 'Pharmacy Dispensing', href: '/staff/pharmacy', icon: Pill },
    ];
  } else if (staffRole === 'LAB_TECH' || staffRole === 'LAB_STAFF') {
    staffNav = [
      { label: 'Diagnostic Lab', href: '/staff/lab', icon: FlaskConical },
    ];
  } else if (staffRole === 'BILLING_CLERK') {
    staffNav = [
      { label: 'Billing & Accounts', href: '/staff/billing', icon: FileText },
    ];
  } else {
    staffNav = [
      { label: 'Staff Workspace', href: '/staff/opd', icon: LayoutDashboard },
    ];
  }

  const adminNav: NavItem[] = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Staff Management', href: '/admin/staff', icon: Shield },
    { label: 'Doctor Directory', href: '/admin/doctors', icon: UserCheck },
    { label: 'Patient Registry', href: '/admin/patients', icon: User },
  ];

  const navItems = isDoctor ? doctorNav : isStaff ? staffNav : isAdmin ? adminNav : userNav;

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

  const isItemActive = (href: string) => {
    if (currentPath === href) return true;

    // Map /user/* with legacy /patient/*
    if (
      href === '/user/dashboard' &&
      (currentPath === '/user' ||
        currentPath === '/user/dashboard' ||
        currentPath === '/patient' ||
        currentPath === '/patient/dashboard')
    ) {
      return true;
    }
    if (href === '/user/appointments' && (currentPath.startsWith('/user/appointments') || currentPath.startsWith('/patient/appointments'))) return true;
    if (href === '/user/journey' && (currentPath.startsWith('/user/journey') || currentPath.startsWith('/patient/journey'))) return true;
    if (href === '/user/records' && (currentPath.startsWith('/user/records') || currentPath.startsWith('/patient/records'))) return true;
    if (href === '/user/profile' && (currentPath.startsWith('/user/profile') || currentPath.startsWith('/patient/profile'))) return true;

    // Map /staff/doctor/* with legacy /doctor/*
    if (
      href === '/staff/doctor/dashboard' &&
      (currentPath === '/staff/doctor' ||
        currentPath === '/staff/doctor/dashboard' ||
        currentPath === '/doctor' ||
        currentPath === '/doctor/dashboard')
    ) {
      return true;
    }
    if (href === '/staff/doctor/schedule' && (currentPath.startsWith('/staff/doctor/schedule') || currentPath.startsWith('/doctor/schedule'))) return true;
    if (href === '/staff/doctor/patients' && (currentPath.startsWith('/staff/doctor/patients') || currentPath.startsWith('/doctor/patients'))) return true;

    // Map /admin/*
    if (href === '/admin/dashboard' && (currentPath === '/admin' || currentPath === '/admin/dashboard')) return true;

    // Default prefix match for other routes
    if (
      href !== '/user/dashboard' &&
      href !== '/staff/doctor/dashboard' &&
      href !== '/admin/dashboard' &&
      currentPath.startsWith(href)
    ) {
      return true;
    }

    return false;
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Portal Navigation">
      <div className="sidebar-section-title">
        {isDoctor ? 'Doctor Workspace' : isStaff ? 'Staff Workspace' : isAdmin ? 'Admin Workspace' : 'User Workspace'}
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = isItemActive(item.href);
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
