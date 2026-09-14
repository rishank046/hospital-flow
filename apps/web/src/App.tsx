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
import './App.css';

function Router() {
  const [path, setPath] = useState(() => window.location.pathname);
  const { isAuthenticated, role, staffRole } = useAuth();

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Public authentication routes
  if (path === '/' || path === '/login') {
    if (isAuthenticated && role) {
      if (role === 'DOCTOR' || (role === 'STAFF' && staffRole === 'DOCTOR')) {
        return (
          <ProtectedRoute allowedRoles={['DOCTOR', 'STAFF']}>
            <DoctorDashboard />
          </ProtectedRoute>
        );
      }
      if (role === 'ADMIN') {
        return (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboardPage />
          </ProtectedRoute>
        );
      }
      if (role === 'STAFF') {
        if (staffRole === 'DOCTOR') {
          return (
            <ProtectedRoute allowedRoles={['DOCTOR', 'STAFF']}>
              <DoctorDashboard />
            </ProtectedRoute>
          );
        }
        return (
          <ProtectedRoute
            allowedRoles={['STAFF']}
            allowedStaffRoles={['NURSE', 'PHARMACIST', 'LAB_TECH', 'RECEPTIONIST', 'BILLING_CLERK', 'LAB_STAFF']}
          >
            <StaffDashboardPage />
          </ProtectedRoute>
        );
      }
      return (
        <ProtectedRoute allowedRoles={['PATIENT']}>
          <PatientDashboard />
        </ProtectedRoute>
      );
    }
    return <LoginPage />;
  }

  if (path === '/register') {
    return <RegisterPage />;
  }

  if (path === '/doctor/login') {
    window.history.replaceState({}, '', '/login');
    return <LoginPage />;
  }

  // Patient protected routes
  if (path === '/patient' || path === '/patient/dashboard') {
    return (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PatientDashboard />
      </ProtectedRoute>
    );
  }

  if (path === '/patient/appointments') {
    return (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PatientAppointmentsPage />
      </ProtectedRoute>
    );
  }

  if (path === '/patient/journey') {
    return (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PatientJourneyPage />
      </ProtectedRoute>
    );
  }

  if (path === '/patient/records') {
    return (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PatientMedicalRecordsPage />
      </ProtectedRoute>
    );
  }

  if (path === '/patient/profile') {
    return (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PatientProfilePage />
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

  // Staff protected routes
  if (path === '/staff' || path === '/staff/dashboard') {
    if (staffRole === 'DOCTOR' || role === 'DOCTOR') {
      window.history.replaceState({}, '', '/doctor/dashboard');
      return (
        <ProtectedRoute allowedRoles={['DOCTOR', 'STAFF']}>
          <DoctorDashboard />
        </ProtectedRoute>
      );
    }
    return (
      <ProtectedRoute
        allowedRoles={['STAFF']}
        allowedStaffRoles={['NURSE', 'PHARMACIST', 'LAB_TECH', 'RECEPTIONIST', 'BILLING_CLERK', 'LAB_STAFF']}
      >
        <StaffDashboardPage />
      </ProtectedRoute>
    );
  }

  // Doctor protected routes
  if (path === '/doctor' || path === '/doctor/dashboard') {
    return (
      <ProtectedRoute allowedRoles={['DOCTOR', 'STAFF']}>
        <DoctorDashboard />
      </ProtectedRoute>
    );
  }

  if (path === '/doctor/schedule') {
    return (
      <ProtectedRoute allowedRoles={['DOCTOR', 'STAFF']}>
        <DoctorSchedulePage />
      </ProtectedRoute>
    );
  }

  if (path === '/doctor/patients') {
    return (
      <ProtectedRoute allowedRoles={['DOCTOR', 'STAFF']}>
        <DoctorPatientsPage />
      </ProtectedRoute>
    );
  }

  if (path.startsWith('/doctor/patients/')) {
    const patientId = path.replace('/doctor/patients/', '').split('/')[0];
    return (
      <ProtectedRoute allowedRoles={['DOCTOR', 'STAFF']}>
        <DoctorPatientDetailPage patientId={patientId} />
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