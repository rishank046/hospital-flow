import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DoctorLoginPage } from './pages/auth/DoctorLoginPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { PatientAppointmentsPage } from './pages/patient/PatientAppointmentsPage';
import { PatientJourneyPage } from './pages/patient/PatientJourneyPage';
import { PatientMedicalRecordsPage } from './pages/patient/PatientMedicalRecordsPage';
import { PatientProfilePage } from './pages/patient/PatientProfilePage';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { DoctorSchedulePage } from './pages/doctor/DoctorSchedulePage';
import { DoctorPatientsPage } from './pages/doctor/DoctorPatientsPage';
import { DoctorPatientDetailPage } from './pages/doctor/DoctorPatientDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import './App.css';

function Router() {
  const [path, setPath] = useState(() => window.location.pathname);
  const { isAuthenticated, role } = useAuth();

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Public authentication routes
  if (path === '/' || path === '/login') {
    if (isAuthenticated && role) {
      return role === 'DOCTOR' ? (
        <ProtectedRoute allowedRoles={['DOCTOR']}>
          <DoctorDashboard />
        </ProtectedRoute>
      ) : (
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
    return <DoctorLoginPage />;
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

  // Doctor protected routes
  if (path === '/doctor' || path === '/doctor/dashboard') {
    return (
      <ProtectedRoute allowedRoles={['DOCTOR']}>
        <DoctorDashboard />
      </ProtectedRoute>
    );
  }

  if (path === '/doctor/schedule') {
    return (
      <ProtectedRoute allowedRoles={['DOCTOR']}>
        <DoctorSchedulePage />
      </ProtectedRoute>
    );
  }

  if (path === '/doctor/patients') {
    return (
      <ProtectedRoute allowedRoles={['DOCTOR']}>
        <DoctorPatientsPage />
      </ProtectedRoute>
    );
  }

  if (path.startsWith('/doctor/patients/')) {
    const patientId = path.replace('/doctor/patients/', '').split('/')[0];
    return (
      <ProtectedRoute allowedRoles={['DOCTOR']}>
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