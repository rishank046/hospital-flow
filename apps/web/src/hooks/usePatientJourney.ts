import { useCallback, useEffect, useState } from 'react';
import type { JourneyEvent, PatientJourneyResponse } from '../types/patient.types';
import { patientService } from '../services/patient.service';

export function usePatientJourney(autoFetch = true) {
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const parseJourneyData = (data: unknown): JourneyEvent[] => {
    if (Array.isArray(data)) {
      return data as JourneyEvent[];
    } else if (data && Array.isArray((data as PatientJourneyResponse).events)) {
      return (data as PatientJourneyResponse).events;
    } else if (data && Array.isArray((data as { journey?: JourneyEvent[] }).journey)) {
      return (data as { journey: JourneyEvent[] }).journey;
    }
    return [];
  };

  const fetchJourney = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientService.getJourney();
      setEvents(parseJourneyData(data));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load journey timeline.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    let isMounted = true;
    patientService
      .getJourney()
      .then((data) => {
        if (isMounted) setEvents(parseJourneyData(data));
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load journey timeline.'
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [autoFetch]);

  return {
    events,
    loading,
    error,
    fetchJourney,
  };
}
