import type { ElementType } from 'react';
import {
  UserCheck,
  Heart,
  Pill,
  FlaskConical,
  Receipt,
  LayoutDashboard,
  Shield,
  User,
  Stethoscope,
  HelpCircle,
} from 'lucide-react';
import type { BadgeVariant } from '../components/common/Badge';
import type { StaffRole, UserRole } from '../types/auth.types';

export type StaffPanelKey =
  | 'RECEPTIONIST'
  | 'NURSE'
  | 'PHARMACIST'
  | 'LAB_TECH'
  | 'BILLING_CLERK'
  | 'DOCTOR'
  | 'UNSUPPORTED';

export interface RolePresentation {
  role: string;
  displayName: string;
  shortRole: string;
  departmentLabel: string;
  stationLabel: string;
  description: string;
  badgeVariant: BadgeVariant;
  panelKey: StaffPanelKey;
  route: string;
  icon: ElementType;
  isSupportedStaffRole: boolean;
}

const STAFF_ROLE_MAP: Record<string, RolePresentation> = {
  RECEPTIONIST: {
    role: 'RECEPTIONIST',
    displayName: 'Reception & Intake',
    shortRole: 'Receptionist',
    departmentLabel: 'Outpatient Department (OPD)',
    stationLabel: 'Intake Counter',
    description: 'Patient registration, walk-in check-in, and OPD routing',
    badgeVariant: 'primary',
    panelKey: 'RECEPTIONIST',
    route: '/staff/opd',
    icon: UserCheck,
    isSupportedStaffRole: true,
  },
  OPD_MANAGER: {
    role: 'OPD_MANAGER',
    displayName: 'OPD Operations',
    shortRole: 'OPD Manager',
    departmentLabel: 'Outpatient Department (OPD)',
    stationLabel: 'OPD Operations Desk',
    description: 'Outpatient flow coordination, queue supervision, and intake management',
    badgeVariant: 'primary',
    panelKey: 'RECEPTIONIST',
    route: '/staff/opd',
    icon: LayoutDashboard,
    isSupportedStaffRole: true,
  },
  NURSE: {
    role: 'NURSE',
    displayName: 'Nursing & Triage',
    shortRole: 'Nurse',
    departmentLabel: 'Nursing & Triage',
    stationLabel: 'Triage Station',
    description: 'Vital signs recording, clinical triage, and consultation prep',
    badgeVariant: 'warning',
    panelKey: 'NURSE',
    route: '/staff/nurse',
    icon: Heart,
    isSupportedStaffRole: true,
  },
  PHARMACIST: {
    role: 'PHARMACIST',
    displayName: 'Pharmacy',
    shortRole: 'Pharmacist',
    departmentLabel: 'Hospital Pharmacy',
    stationLabel: 'Dispensing Counter',
    description: 'Prescription verification, medication dispensing, and fulfillment',
    badgeVariant: 'success',
    panelKey: 'PHARMACIST',
    route: '/staff/pharmacy',
    icon: Pill,
    isSupportedStaffRole: true,
  },
  LAB_TECH: {
    role: 'LAB_TECH',
    displayName: 'Laboratory',
    shortRole: 'Lab Technician',
    departmentLabel: 'Diagnostic Laboratory',
    stationLabel: 'Diagnostics Bench',
    description: 'Sample collection, test processing, and investigation results',
    badgeVariant: 'primary',
    panelKey: 'LAB_TECH',
    route: '/staff/lab',
    icon: FlaskConical,
    isSupportedStaffRole: true,
  },
  LAB_STAFF: {
    role: 'LAB_STAFF',
    displayName: 'Laboratory',
    shortRole: 'Lab Staff',
    departmentLabel: 'Diagnostic Laboratory',
    stationLabel: 'Diagnostics Bench',
    description: 'Sample collection, test processing, and investigation results',
    badgeVariant: 'primary',
    panelKey: 'LAB_TECH',
    route: '/staff/lab',
    icon: FlaskConical,
    isSupportedStaffRole: true,
  },
  BILLING_CLERK: {
    role: 'BILLING_CLERK',
    displayName: 'Billing & Cash',
    shortRole: 'Billing Clerk',
    departmentLabel: 'Finance & Accounts',
    stationLabel: 'Cash Counter',
    description: 'Invoicing, payment collection, and account settlement',
    badgeVariant: 'success',
    panelKey: 'BILLING_CLERK',
    route: '/staff/billing',
    icon: Receipt,
    isSupportedStaffRole: true,
  },
  DOCTOR: {
    role: 'DOCTOR',
    displayName: 'Clinical Consultation',
    shortRole: 'Doctor',
    departmentLabel: 'Clinical Department',
    stationLabel: 'Consultation Room',
    description: 'Patient diagnosis, clinical care plans, and investigations',
    badgeVariant: 'primary',
    panelKey: 'DOCTOR',
    route: '/staff/doctor/dashboard',
    icon: Stethoscope,
    isSupportedStaffRole: true,
  },
};

export function getStaffRolePresentation(role?: string | null): RolePresentation {
  const normalized = (role || '').trim().toUpperCase();
  if (normalized && STAFF_ROLE_MAP[normalized]) {
    return STAFF_ROLE_MAP[normalized];
  }

  return {
    role: normalized || 'UNKNOWN',
    displayName: normalized ? normalized.replace(/_/g, ' ') : 'Staff Workspace',
    shortRole: normalized ? normalized.replace(/_/g, ' ') : 'Staff',
    departmentLabel: 'Clinical Operations',
    stationLabel: 'Staff Station',
    description: 'Hospital operational workstation',
    badgeVariant: 'neutral',
    panelKey: 'UNSUPPORTED',
    route: '/staff/opd',
    icon: HelpCircle,
    isSupportedStaffRole: false,
  };
}

export function getUserRolePresentation(
  role?: UserRole | string | null,
  staffRole?: StaffRole | string | null
): RolePresentation {
  const normRole = (role || '').trim().toUpperCase();
  const normStaffRole = (staffRole || '').trim().toUpperCase();

  if (normRole === 'ADMIN') {
    return {
      role: 'ADMIN',
      displayName: 'Administration',
      shortRole: 'Admin',
      departmentLabel: 'Hospital Administration',
      stationLabel: 'Operations Center',
      description: 'System administration, staff access, and facility oversight',
      badgeVariant: 'warning',
      panelKey: 'UNSUPPORTED',
      route: '/admin/dashboard',
      icon: Shield,
      isSupportedStaffRole: false,
    };
  }

  if (normRole === 'DOCTOR' || (normRole === 'STAFF' && normStaffRole === 'DOCTOR')) {
    return STAFF_ROLE_MAP.DOCTOR;
  }

  if (normRole === 'STAFF' && normStaffRole) {
    return getStaffRolePresentation(normStaffRole);
  }

  if (normRole === 'USER' || normRole === 'PATIENT') {
    return {
      role: normRole || 'USER',
      displayName: 'Patient Services',
      shortRole: 'Patient',
      departmentLabel: 'Outpatient Care',
      stationLabel: 'Personal Care Stream',
      description: 'Appointments, health records, and treatment tracking',
      badgeVariant: 'primary',
      panelKey: 'UNSUPPORTED',
      route: '/user/dashboard',
      icon: User,
      isSupportedStaffRole: false,
    };
  }

  return getStaffRolePresentation(normStaffRole || normRole);
}
