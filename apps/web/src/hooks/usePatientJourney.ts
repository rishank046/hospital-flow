import { useCallback, useEffect, useState } from 'react';
import type { JourneyEvent, PatientJourneyResponse } from '../types/patient.types';
import { patientService } from '../services/patient.service';

export function usePatientJourney(autoFetch = true) {
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJourney = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientService.getJourney();
      if (Array.isArray(data)) {
        setEvents(data);
      } else if (data && Array.isArray((data as PatientJourneyResponse).events)) {
        setEvents((data as PatientJourneyResponse).events);
      } else if (data && Array.isArray((data as { journey?: JourneyEvent[] }).journey)) {
        setEvents((data as { journey: JourneyEvent[] }).journey);
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load journey timeline.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      void fetchJourney();
    }
  }, [autoFetch, fetchJourney]);

  return {
    events,
    loading,
    error,
    fetchJourney,
  };
}
