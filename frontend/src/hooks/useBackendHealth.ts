import { useQuery } from '@tanstack/react-query';
import { getBackendHealth } from '../api/health.api';
import { BackendHealth } from '../types/api';

export function useBackendHealth() {
  return useQuery<BackendHealth>({
    queryKey: ['backend', 'health'],
    queryFn: getBackendHealth,
    refetchInterval: 10000,
    retry: false,
  });
}

