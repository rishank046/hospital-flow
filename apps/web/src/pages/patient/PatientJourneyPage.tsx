import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { JourneyTimeline } from '../../components/patient/JourneyTimeline';
import { usePatientJourney } from '../../hooks/usePatientJourney';
import { Button } from '../../components/common/Button';

export function PatientJourneyPage() {
  const { events, loading, error, fetchJourney } = usePatientJourney(true);

  return (
    <DashboardLayout
      pageTitle="Care Journey Timeline"
      pageSubtitle="Follow your end-to-end clinical progression through triage, consultation, and diagnosis."
      headerAction={
        <Button variant="outline" onClick={fetchJourney} disabled={loading}>
          ↻ Refresh Timeline
        </Button>
      }
    >
      <JourneyTimeline
        events={events}
        loading={loading}
        error={error}
        onRetry={fetchJourney}
      />
    </DashboardLayout>
  );
}
