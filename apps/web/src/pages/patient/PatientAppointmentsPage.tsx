import { useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { AppointmentList } from '../../components/patient/AppointmentList';
import { BookAppointmentModal } from '../../components/patient/BookAppointmentModal';
import { Button } from '../../components/common/Button';
import { useAppointments } from '../../hooks/useAppointments';
import type { BookAppointmentPayload } from '../../types/patient.types';

export function PatientAppointmentsPage() {
  const { appointments, loading, error, fetchAppointments, bookAppointment, cancelAppointment } =
    useAppointments(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBook = async (payload: BookAppointmentPayload) => {
    await bookAppointment(payload);
    await fetchAppointments();
  };

  return (
    <DashboardLayout
      pageTitle="Appointments"
      pageSubtitle="Schedule, reschedule, or cancel consultations with attending hospital doctors."
      headerAction={
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          + Book Appointment
        </Button>
      }
    >
      <AppointmentList
        appointments={appointments}
        loading={loading}
        error={error}
        onCancel={cancelAppointment}
        onRetry={fetchAppointments}
      />

      <BookAppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onBook={handleBook}
      />
    </DashboardLayout>
  );
}
