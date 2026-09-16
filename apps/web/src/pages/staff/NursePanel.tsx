import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Activity,
  Heart,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { staffService } from '../../services/staff.service';
import type { VisitItem, VisitStatus } from '../../types/staff.types';

export function NursePanel() {
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<'AWAITING_VITALS' | 'ALL'>('AWAITING_VITALS');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected visit for Vitals Entry Modal
  const [selectedVisit, setSelectedVisit] = useState<VisitItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Vitals form fields
  const [temperature, setTemperature] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [notes, setNotes] = useState('');

  // Submit & feedback states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadVisits = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await staffService.getVisits();
      setVisits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    staffService
      .getVisits()
      .then((data) => {
        if (mounted) {
          setVisits(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load visits.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openVitalsModal = (visit: VisitItem) => {
    setSelectedVisit(visit);
    // Reset form
    setTemperature('');
    setHeartRate('');
    setBloodPressure('');
    setRespiratoryRate('');
    setOxygenSaturation('');
    setWeight('');
    setHeight('');
    setNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeVitalsModal = () => {
    setIsModalOpen(false);
    setSelectedVisit(null);
  };

  const handleVitalsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;

    setSubmitting(true);
    setFormError(null);

    const payload = {
      temperature: temperature ? parseFloat(temperature) : null,
      heartRate: heartRate ? parseInt(heartRate, 10) : null,
      bloodPressure: bloodPressure.trim() || null,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate, 10) : null,
      oxygenSaturation: oxygenSaturation ? parseFloat(oxygenSaturation) : null,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      notes: notes.trim() || null,
    };

    try {
      // 1. Record vitals for this visit
      await staffService.recordVitals(selectedVisit.id, payload);

      // 2. If visit is in VITALS, transition it to WAITING_OPD so it enters the doctor consultation stream
      try {
        await staffService.updateVisitStatus(selectedVisit.id, 'WAITING_OPD');
      } catch {
        // Status may already be transitioned by backend vitals recorder
      }

      setSuccessMessage(
        `Vitals recorded successfully for ${selectedVisit.patient_name || 'patient'}. Visit moved to OPD Queue.`
      );
      closeVitalsModal();
      loadVisits();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record vitals.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter visits
  const filteredVisits = visits.filter((v) => {
    if (statusFilter === 'AWAITING_VITALS') {
      if (v.status !== 'VITALS' && v.status !== 'REGISTERED') {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (v.patient_name || '').toLowerCase().includes(q);
      const docMatch = (v.doctor_name || '').toLowerCase().includes(q);
      const idMatch = v.id.toLowerCase().includes(q);
      return nameMatch || docMatch || idMatch;
    }
    return true;
  });

  const getStatusBadgeVariant = (status: VisitStatus) => {
    switch (status) {
      case 'VITALS':
        return 'warning';
      case 'REGISTERED':
        return 'primary';
      case 'WAITING_OPD':
        return 'neutral';
      case 'IN_CONSULTATION':
        return 'primary';
      case 'COMPLETED':
        return 'success';
      default:
        return 'neutral';
    }
  };

  const awaitingCount = visits.filter(
    (v) => v.status === 'VITALS' || v.status === 'REGISTERED'
  ).length;
  const triagedCount = visits.filter((v) => v.status === 'WAITING_OPD').length;
  const inConsultCount = visits.filter((v) => v.status === 'IN_CONSULTATION').length;

  return (
    <div className="nurse-panel">
      {error && (
        <Alert type="error" className="mb-4" onRetry={loadVisits}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" className="mb-4" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Workspace Header */}
      <div className="station-header">
        <div className="station-header-info">
          <h3>
            <Heart size={20} aria-hidden="true" />
            Nursing & Triage Station
          </h3>
          <p>Record vital signs, assess clinical triage priority, and prepare patients for consultation</p>
        </div>

        <div className="station-header-actions">
          <Button
            variant="outline"
            onClick={loadVisits}
            loading={loading}
            icon={<RefreshCw size={16} />}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Workload Summary (Section 12) */}
      <div className="metrics-summary-row mb-6">
        <Card className="summary-stat-card">
          <span className="stat-label">Awaiting Vitals</span>
          <strong className="stat-value">{awaitingCount}</strong>
          <span className="stat-hint">Active patients queued for triage</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Triaged & Ready</span>
          <strong className="stat-value">{triagedCount}</strong>
          <span className="stat-hint">Vitals recorded • Ready for OPD</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">In Consultation</span>
          <strong className="stat-value">{inConsultCount}</strong>
          <span className="stat-hint">Attending specialist room</span>
        </Card>

        <Card className="summary-stat-card">
          <span className="stat-label">Active Workload</span>
          <strong className="stat-value">{visits.length}</strong>
          <span className="stat-hint">Total registered patient encounters</span>
        </Card>
      </div>

      {/* Main Patient Triage Card */}
      <Card>
        <div className="station-header" style={{ marginBottom: '14px' }}>
          <div className="station-header-info">
            <h3 style={{ fontSize: '18px' }}>
              Triage & Vitals Queue ({filteredVisits.length})
            </h3>
            <p>Select a patient visit below to assess and record vital signs</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="station-filter-bar">
          <div className="station-search-box">
            <Input
              placeholder="Search patient by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Triage status filter">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'AWAITING_VITALS'}
              className={`filter-tab-btn ${statusFilter === 'AWAITING_VITALS' ? 'active' : ''}`}
              onClick={() => setStatusFilter('AWAITING_VITALS')}
            >
              Awaiting Vitals ({awaitingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'ALL'}
              className={`filter-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Visits ({visits.length})
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading triage queue..." />
        ) : filteredVisits.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No patients awaiting triage"
            description="All registered patients have had their vitals recorded, or no visits match your search criteria."
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visit ID</th>
                  <th>Patient Name</th>
                  <th>Visit Type</th>
                  <th>Assigned Doctor</th>
                  <th>Status</th>
                  <th>Time In</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisits.map((v) => (
                  <tr key={v.id}>
                    <td className="cell-id">{v.id.slice(0, 8)}</td>
                    <td className="cell-name">{v.patient_name || 'Patient'}</td>
                    <td>
                      <Badge variant="neutral" size="sm">
                        {v.visit_type}
                      </Badge>
                    </td>
                    <td className="cell-meta">
                      {v.doctor_name ? `Dr. ${v.doctor_name}` : 'Unassigned'}
                    </td>
                    <td>
                      <Badge variant={getStatusBadgeVariant(v.status)} size="sm">
                        {v.status}
                      </Badge>
                    </td>
                    <td className="cell-meta">
                      {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="cell-actions">
                      <Button
                        variant={v.status === 'VITALS' || v.status === 'REGISTERED' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => openVitalsModal(v)}
                        icon={<Activity size={14} />}
                      >
                        {v.status === 'VITALS' || v.status === 'REGISTERED'
                          ? 'Record Vitals'
                          : 'Update Vitals'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Vitals Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeVitalsModal}
        title={`Record Vitals: ${selectedVisit?.patient_name || 'Patient'}`}
      >
        <form onSubmit={handleVitalsSubmit}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--surface-subtle, #f8fafc)', borderRadius: '6px' }}>
            <p className="text-xs text-secondary" style={{ margin: 0 }}>
              Visit ID: <strong>{selectedVisit?.id.slice(0, 8)}</strong> • Type: <strong>{selectedVisit?.visit_type}</strong>
              {selectedVisit?.doctor_name ? ` • Doctor: Dr. ${selectedVisit.doctor_name}` : ''}
            </p>
          </div>

          {formError && (
            <Alert type="error" className="mb-4">
              {formError}
            </Alert>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <Input
              label="Temperature (°C)"
              type="number"
              step="0.1"
              placeholder="e.g. 37.0"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />

            <Input
              label="Heart Rate (bpm)"
              type="number"
              placeholder="e.g. 72"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              leftIcon={<Heart size={16} />}
            />

            <Input
              label="Blood Pressure (mmHg)"
              placeholder="e.g. 120/80"
              value={bloodPressure}
              onChange={(e) => setBloodPressure(e.target.value)}
            />

            <Input
              label="Respiratory Rate (breaths/min)"
              type="number"
              placeholder="e.g. 16"
              value={respiratoryRate}
              onChange={(e) => setRespiratoryRate(e.target.value)}
            />

            <Input
              label="Oxygen Saturation SpO2 (%)"
              type="number"
              step="0.1"
              placeholder="e.g. 98"
              value={oxygenSaturation}
              onChange={(e) => setOxygenSaturation(e.target.value)}
            />

            <Input
              label="Weight (kg)"
              type="number"
              step="0.1"
              placeholder="e.g. 68.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />

            <Input
              label="Height (cm)"
              type="number"
              step="0.1"
              placeholder="e.g. 175"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>

          <div className="form-field" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Clinical Observations & Triage Notes</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="e.g. Patient presents with mild headache, alert and oriented..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" type="button" onClick={closeVitalsModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} icon={<CheckCircle2 size={16} />}>
              Save Vitals & Send to OPD Queue
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
