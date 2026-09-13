import { useCallback, useEffect, useState } from 'react';
import type { Appointment, BookAppointmentPayload } from '../types/patient.types';
import { patientService } from '../services/patient.service';

export function useAppointments(autoFetch = true) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientService.getAppointments();
      setAppointments(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load appointments.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const bookAppointment = useCallback(
    async (payload: BookAppointmentPayload) => {
      setLoading(true);
      setError(null);
      try {
        const newAppointment = await patientService.bookAppointment(payload);
        setAppointments((prev) => [...prev, newAppointment]);
        return newAppointment;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to book appointment.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const cancelAppointment = useCallback(async (appointmentId: string) => {
    setLoading(true);
    setError(null);
    try {
      await patientService.cancelAppointment(appointmentId);
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId ? { ...apt, status: 'CANCELLED' as const } : apt
        )
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to cancel appointment.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      void fetchAppointments();
    }
  }, [autoFetch, fetchAppointments]);

  return {
    appointments,
    loading,
    error,
    fetchAppointments,
    bookAppointment,
    cancelAppointment,
  };
}
