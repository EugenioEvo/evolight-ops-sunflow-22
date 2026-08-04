import { useQuery } from '@tanstack/react-query';
import { activitiesService } from '../services/activitiesService';

export function useActivitiesQuery() {
  return useQuery({
    queryKey: ['activities-unified'],
    queryFn: () => activitiesService.fetchAll(),
    staleTime: 60_000,
  });
}
