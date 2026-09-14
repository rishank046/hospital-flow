import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { BookAppointmentPayload } from '../../types/patient.types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Alert } from '../common/Alert';
import { request } from '../../services/api.client';

export interface DoctorOption {
  id: string;
  name: string;
  specialization?: string;
  department?: string;
  consultation_minutes?: number;
}

export interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBook: (payload: BookAppointmentPayload) => Promise<void>;
}

export function BookAppointmentModal({
  isOpen,
  onClose,
  onBook,
}: BookAppointmentModalProps) {
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadDoctors() {
      try {
        setLoadingDoctors(true);
        const data = await request<{ doctors?: DoctorOption[] } | DoctorOption[]>('/doctors');
        if (!mounted) return;
        const list = Array.isArray(data) ? data : data.doctors || [];
        setDoctors(list);

        // Pre-select first doctor if available and none selected
        if (list.length > 0 && !doctorId) {
          const first = list[0];
          setDoctorId(first.id);
          if (first.consultation_minutes) {
            setDurationMinutes(String(first.consultation_minutes));
          }
        }
      } catch (err) {
        console.error('Failed to load doctors list:', err);
      } finally {
        if (mounted) setLoadingDoctors(false);
      }
    }

    loadDoctors();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Unique specializations derived from loaded doctors
  const specializations = Array.from(
    new Set(doctors.map((d) => d.specialization).filter(Boolean))
  ) as string[];

  // Doctors filtered by selected specialization
  const filteredDoctors = selectedSpecialization
    ? doctors.filter((d) => d.specialization === selectedSpecialization)
    : doctors;

  const handleSpecializationChange = (spec: string) => {
    setSelectedSpecialization(spec);
    const matching = spec
      ? doctors.filter((d) => d.specialization === spec)
      : doctors;
    if (matching.length > 0) {
      setDoctorId(matching[0].id);
      if (matching[0].consultation_minutes) {
        setDurationMinutes(String(matching[0].consultation_minutes));
      }
    } else {
      setDoctorId('');
    }
  };

  const handleDoctorChange = (id: string) => {
    setDoctorId(id);
    const found = doctors.find((d) => d.id === id);
    if (found?.consultation_minutes) {
      setDurationMinutes(String(found.consultation_minutes));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!doctorId.trim()) {
      setError('Please select a doctor to book an appointment.');
      return;
    }
    if (!date) {
      setError('Please choose an appointment date.');
      return;
    }

    try {
      setLoading(true);
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(
        startDateTime.getTime() + parseInt(durationMinutes, 10) * 60 * 1000
      );

      await onBook({
        doctorId: doctorId.trim(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to book appointment. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book New Appointment">
      <form onSubmit={handleSubmit} className="book-appointment-form">
        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="form-field mb-3">
          <label htmlFor="specialization-select" className="form-label">
            Specialization
          </label>
          <div className="input-wrap">
            <select
              id="specialization-select"
              className="form-input"
              value={selectedSpecialization}
              onChange={(e) => handleSpecializationChange(e.target.value)}
              disabled={loadingDoctors || loading}
            >
              <option value="">All Specializations ({doctors.length} doctors)</option>
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field mb-3">
          <label htmlFor="doctor-select" className="form-label">
            Doctor <span className="text-red-500">*</span>
          </label>
          <div className="input-wrap">
            <select
              id="doctor-select"
              className="form-input"
              value={doctorId}
              onChange={(e) => handleDoctorChange(e.target.value)}
              disabled={loadingDoctors || loading}
              required
            >
              {loadingDoctors ? (
                <option value="">Loading available doctors...</option>
              ) : filteredDoctors.length === 0 ? (
                <option value="">No doctors available for this specialization</option>
              ) : (
                filteredDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.name} — {doc.specialization || 'General'}{' '}
                    {doc.department ? `(${doc.department})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <Input
          label="Appointment Date"
          type="date"
          value={date}
          min={new Date().toISOString().split('T')[0]}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <div className="form-row">
          <Input
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />

          <div className="form-field">
            <label htmlFor="duration-select" className="form-label">
              Duration
            </label>
            <div className="input-wrap">
              <select
                id="duration-select"
                className="form-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              >
                <option value="15">15 Minutes</option>
                <option value="20">20 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={!doctorId}>
            Confirm Booking
          </Button>
        </div>
      </form>
    </Modal>
  );
}
