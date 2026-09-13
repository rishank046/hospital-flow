import { useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import type {
  CreateConsultationPayload,
  PrescriptionInput,
} from '../../types/doctor.types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Alert } from '../common/Alert';

export interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  appointmentId?: string;
  onSubmit: (data: CreateConsultationPayload) => Promise<void>;
}

export function ConsultationModal({
  isOpen,
  onClose,
  appointmentId,
  onSubmit,
}: ConsultationModalProps) {
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New prescription line state
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [instructions, setInstructions] = useState('');

  const addPrescription = () => {
    if (!medication.trim() || !dosage.trim()) {
      return;
    }
    setPrescriptions((prev) => [
      ...prev,
      {
        medication: medication.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim() || undefined,
        duration: duration.trim() || undefined,
        instructions: instructions.trim() || undefined,
      },
    ]);
    setMedication('');
    setDosage('');
    setFrequency('');
    setDuration('');
    setInstructions('');
  };

  const removePrescription = (index: number) => {
    setPrescriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!diagnosis.trim()) {
      setError('Diagnosis is required.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        appointmentId,
        diagnosis: diagnosis.trim(),
        notes: notes.trim() || undefined,
        treatmentPlan: treatmentPlan.trim() || undefined,
        prescriptions: prescriptions.length > 0 ? prescriptions : undefined,
      });

      // reset
      setDiagnosis('');
      setNotes('');
      setTreatmentPlan('');
      setPrescriptions([]);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to record consultation.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Consultation">
      <form onSubmit={handleSubmit} className="consultation-form">
        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}

        <Input
          label="Primary Diagnosis *"
          placeholder="e.g. Acute bronchitis, Mild hypertension"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          required
        />

        <div className="form-field">
          <label htmlFor="notes" className="form-label">
            Clinical Notes & Observations
          </label>
          <div className="input-wrap">
            <textarea
              id="notes"
              className="form-textarea"
              rows={3}
              placeholder="Symptoms reported, physical exam findings..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="treatmentPlan" className="form-label">
            Treatment Plan
          </label>
          <div className="input-wrap">
            <textarea
              id="treatmentPlan"
              className="form-textarea"
              rows={3}
              placeholder="Recommended interventions, follow-up schedule..."
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
            />
          </div>
        </div>

        <div className="prescriptions-builder-box">
          <h4 className="builder-heading">Prescribe Medications</h4>

          {prescriptions.length > 0 && (
            <div className="staged-prescriptions-list">
              {prescriptions.map((p, idx) => (
                <div key={idx} className="staged-rx-pill">
                  <span>
                    <strong>{p.medication}</strong> ({p.dosage})
                    {p.frequency && ` - ${p.frequency}`}
                  </span>
                  <button
                    type="button"
                    className="remove-rx-btn"
                    onClick={() => removePrescription(idx)}
                    aria-label="Remove medication"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="add-rx-row">
            <Input
              placeholder="Medication"
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
            />
            <Input
              placeholder="Dosage (e.g. 500mg)"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
            />
            <Input
              placeholder="Frequency (e.g. Twice daily)"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
            <Input
              placeholder="Duration (e.g. 7 days)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addPrescription}
              disabled={!medication.trim() || !dosage.trim()}
            >
              + Add
            </Button>
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
            Save Consultation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
