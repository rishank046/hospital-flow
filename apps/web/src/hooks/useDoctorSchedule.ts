import { useCallback, useEffect, useState } from 'react';
import type { ScheduleItem } from '../types/doctor.types';
import { doctorService } from '../services/doctor.service';

export function useDoctorSchedule(autoFetch = true) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await doctorService.getSchedule();
      setSchedule(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load doctor schedule.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      void fetchSchedule();
    }
  }, [autoFetch, fetchSchedule]);

  return {
    schedule,
    loading,
    error,
    fetchSchedule,
  };
}
