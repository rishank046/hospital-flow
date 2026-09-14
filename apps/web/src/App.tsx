import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { PatientAppointmentsPage } from './pages/patient/PatientAppointmentsPage';
import { PatientJourneyPage } from './pages/patient/PatientJourneyPage';
import { PatientMedicalRecordsPage } from './pages/patient/PatientMedicalRecordsPage';
import { PatientProfilePage } from './pages/patient/PatientProfilePage';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { DoctorSchedulePage } from './pages/doctor/DoctorSchedulePage';
import { DoctorPatientsPage } from './pages/doctor/DoctorPatientsPage';
import { DoctorPatientDetailPage } from './pages/doctor/DoctorPatientDetailPage';
import { StaffDashboardPage } from './pages/staff/StaffDashboardPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { AdminStaffDetailPage } from './pages/admin/AdminStaffDetailPage';
import { AdminDoctorsPage } from './pages/admin/AdminDoctorsPage';
import { AdminPatientsPage } from './pages/admin/AdminPatientsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import type { StaffRole, UserRole } from './types/auth.types';
import './App.css';

function getRoleHomePath(role?: UserRole | null, staffRole?: StaffRole | null): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'USER' || role === 'PATIENT') return '/user';
  if (role === 'DOCTOR') return '/staff/doctor';
  if (role === 'STAFF') {
    switch (staffRole) {
      case 'DOCTOR':
        return '/staff/doctor';
      case 'OPD_MANAGER':
      case 'RECEPTIONIST':
        return '/staff/opd';
      case 'LAB_TECH':
      case 'LAB_STAFF':
        return '/staff/lab';
      case 'PHARMACIST':
        return '/staff/pharmacy';
      case 'BILLING_CLERK':
        return '/staff/billing';
      case 'NURSE':
        return '/staff/nurse';
      default:
        return '/staff/opd';
    }
  }
  return '/user';
}

function Router() {
  const [path, setPath] = useState(() => window.location.pathname);
  const { isAuthenticated, role, staffRole, loading } = useAuth();

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Handle redirects for legacy login paths
  useEffect(() => {
    if (
      path === '/doctor/login' ||
      path === '/staff/login' ||
      path === '/admin/login' ||
      path === '/patient/login'
    ) {
      window.history.replaceState({}, '', '/login');
      setPath('/login');
    }
  }, [path]);

  // If visiting / or /login while authenticated, redirect to role home
  useEffect(() => {
    if (!loading && isAuthenticated && role && (path === '/' || path === '/login')) {
      const home = getRoleHomePath(role, staffRole);
      window.history.replaceState({}, '', home);
      setPath(home);
    }
  }, [loading, isAuthenticated, role, staffRole, path]);

  // If visiting /staff or /staff/dashboard, redirect to specific role area
  useEffect(() => {
    if (!loading && isAuthenticated && (path === '/staff' || path === '/staff/dashboard')) {
      const home = getRoleHomePath(role, staffRole);
      window.history.replaceState({}, '', home);
      setPath(home);
    }
  }, [loading, isAuthenticated, role, staffRole, path]);

  // Public authentication routes
  if (path === '/' || path === '/login') {
    if (loading) {
      return <div className="loading-screen">Verifying session...</div>;
    }
    if (isAuthenticated && role) {
      if (role === 'ADMIN') {
        return (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboardPage />
          </ProtectedRoute>
        );
      }
      if (role === 'DOCTOR' || (role === 'STAFF' && staffRole === 'DOCTOR')) {
        return (
          <ProtectedRoute allowedRoles={['STAFF', 'DOCTOR']} allowedStaffRoles={['DOCTOR']}>
            <DoctorDashboard />
          </ProtectedRoute>
        );
      }
      if (role === 'STAFF') {
        return (
          <ProtectedRoute allowedRoles={['STAFF']}>
            <StaffDashboardPage roleOverride={staffRole ?? undefined} />
          </ProtectedRoute>
        );
      }
      return (
        <ProtectedRoute allowedRoles={['USER', 'PATIENT']}>
          <PatientDashboard />
        </ProtectedRoute>
      );
    }
    return <LoginPage />;
  }

  if (path === '/register') {
    return <RegisterPage />;
  }

  // Patient / User protected routes (/user/* and legacy /patient/*)
  if (
    path === '/user' ||
    path === '/user/dashboard' ||
    path === '/patient' ||
    path === '/patient/dashboard'
  ) {
    return (
      <ProtectedRoute allowedRoles={['USER', 'PATIENT']}>
        <PatientDashboard />
      </ProtectedRoute>
    );
  }

  if (path === '/user/appointments' || path === '/patient/appointments') {
    return (
      <ProtectedRoute allowedRoles={['USER', 'PATIENT']}>
        <PatientAppointmentsPage />
      </ProtectedRoute>
    );
  }

  if (path === '/user/journey' || path === '/patient/journey') {
    return (
      <ProtectedRoute allowedRoles={['USER', 'PATIENT']}>
        <PatientJourneyPage />
      </ProtectedRoute>
    );
  }

  if (path === '/user/records' || path === '/patient/records') {
    return (
      <ProtectedRoute allowedRoles={['USER', 'PATIENT']}>
        <PatientMedicalRecordsPage />
      </ProtectedRoute>
    );
  }

  if (path === '/user/profile' || path === '/patient/profile') {
    return (
      <ProtectedRoute allowedRoles={['USER', 'PATIENT']}>
        <PatientProfilePage />
      </ProtectedRoute>
    );
  }

  // Doctor protected routes (/staff/doctor/* and legacy /doctor/*)
  if (
    path === '/staff/doctor' ||
    path === '/staff/doctor/dashboard' ||
    path === '/doctor' ||
    path === '/doctor/dashboard'
  ) {
    return (
      <ProtectedRoute allowedRoles={['STAFF', 'DOCTOR']} allowedStaffRoles={['DOCTOR']}>
        <DoctorDashboard />
      </ProtectedRoute>
    );
  }

  if (path === '/staff/doctor/schedule' || path === '/doctor/schedule') {
    return (
      <ProtectedRoute allowedRoles={['STAFF', 'DOCTOR']} allowedStaffRoles={['DOCTOR']}>
        <DoctorSchedulePage />
      </ProtectedRoute>
    );
  }

  if (path === '/staff/doctor/patients' || path === '/doctor/patients') {
    return (
      <ProtectedRoute allowedRoles={['STAFF', 'DOCTOR']} allowedStaffRoles={['DOCTOR']}>
        <DoctorPatientsPage />
      </ProtectedRoute>
    );
  }

  if (path.startsWith('/staff/doctor/patients/') || path.startsWith('/doctor/patients/')) {
    const prefix = path.startsWith('/staff/doctor/patients/')
      ? '/staff/doctor/patients/'
      : '/doctor/patients/';
    const patientId = path.replace(prefix, '').split('/')[0];
    return (
      <ProtectedRoute allowedRoles={['STAFF', 'DOCTOR']} allowedStaffRoles={['DOCTOR']}>
        <DoctorPatientDetailPage patientId={patientId} />
      </ProtectedRoute>
    );
  }

  // Specific Staff protected routes
  if (path === '/staff/opd' || path.startsWith('/staff/opd/')) {
    return (
      <ProtectedRoute
        allowedRoles={['STAFF']}
        allowedStaffRoles={['OPD_MANAGER', 'RECEPTIONIST']}
      >
        <StaffDashboardPage roleOverride="OPD_MANAGER" />
      </ProtectedRoute>
    );
  }

  if (path === '/staff/lab' || path.startsWith('/staff/lab/')) {
    return (
      <ProtectedRoute
        allowedRoles={['STAFF']}
        allowedStaffRoles={['LAB_TECH', 'LAB_STAFF']}
      >
        <StaffDashboardPage roleOverride="LAB_TECH" />
      </ProtectedRoute>
    );
  }

  if (path === '/staff/pharmacy' || path.startsWith('/staff/pharmacy/')) {
    return (
      <ProtectedRoute allowedRoles={['STAFF']} allowedStaffRoles={['PHARMACIST']}>
        <StaffDashboardPage roleOverride="PHARMACIST" />
      </ProtectedRoute>
    );
  }

  if (path === '/staff/billing' || path.startsWith('/staff/billing/')) {
    return (
      <ProtectedRoute allowedRoles={['STAFF']} allowedStaffRoles={['BILLING_CLERK']}>
        <StaffDashboardPage roleOverride="BILLING_CLERK" />
      </ProtectedRoute>
    );
  }

  if (path === '/staff/nurse' || path.startsWith('/staff/nurse/')) {
    return (
      <ProtectedRoute allowedRoles={['STAFF']} allowedStaffRoles={['NURSE']}>
        <StaffDashboardPage roleOverride="NURSE" />
      </ProtectedRoute>
    );
  }

  // Generic /staff fallback
  if (path === '/staff' || path === '/staff/dashboard') {
    return (
      <ProtectedRoute allowedRoles={['STAFF', 'DOCTOR']}>
        <StaffDashboardPage />
      </ProtectedRoute>
    );
  }

  // Admin protected routes
  if (path === '/admin' || path === '/admin/dashboard') {
    return (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminDashboardPage />
      </ProtectedRoute>
    );
  }

  if (path === '/admin/staff') {
    return (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminStaffPage />
      </ProtectedRoute>
    );
  }

  if (path.startsWith('/admin/staff/')) {
    const staffId = path.replace('/admin/staff/', '').split('/')[0];
    return (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminStaffDetailPage staffId={staffId} />
      </ProtectedRoute>
    );
  }

  if (path === '/admin/doctors') {
    return (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminDoctorsPage />
      </ProtectedRoute>
    );
  }

  if (path === '/admin/patients') {
    return (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminPatientsPage />
      </ProtectedRoute>
    );
  }

  return <NotFoundPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}