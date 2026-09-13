import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateInvestigationOrderPayload } from '../../types/doctor.types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Alert } from '../common/Alert';

export interface OrderLabTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  onSubmit: (data: CreateInvestigationOrderPayload) => Promise<void>;
}

export function OrderLabTestModal({
  isOpen,
  onClose,
  onSubmit,
}: OrderLabTestModalProps) {
  const [testName, setTestName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!testName.trim()) {
      setError('Test name is required.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        testName: testName.trim(),
        instructions: instructions.trim() || undefined,
      });

      setTestName('');
      setInstructions('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to order lab test.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Diagnostic / Lab Test">
      <form onSubmit={handleSubmit} className="order-lab-form">
        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}

        <Input
          label="Test Name *"
          placeholder="e.g. Complete Blood Count (CBC), Lipid Panel"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          required
        />

        <div className="form-field">
          <label htmlFor="testInstructions" className="form-label">
            Preparation Instructions / Clinical Notes
          </label>
          <div className="input-wrap">
            <textarea
              id="testInstructions"
              className="form-textarea"
              rows={3}
              placeholder="Fasting required 12 hours prior, morning draw..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
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
            Place Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
