import { useState } from 'react';
import type { FormEvent } from 'react';
import type { BookAppointmentPayload } from '../../types/patient.types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Alert } from '../common/Alert';

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
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!doctorId.trim()) {
      setError('Please enter a Doctor ID or select a doctor.');
      return;
    }
    if (!date) {
      setError('Please choose a date.');
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

        <Input
          label="Doctor ID / Specialist UUID"
          placeholder="e.g. 709191d8-0ce0-449e-ba21-197aaef7c86e"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          required
        />

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
          <Button type="submit" variant="primary" loading={loading}>
            Confirm Booking
          </Button>
        </div>
      </form>
    </Modal>
  );
}
