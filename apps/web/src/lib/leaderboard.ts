import type { LeaderboardResponse } from '@cydemic/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 12000);

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api<LeaderboardResponse>('/leaderboard'),
    refetchInterval: POLL_MS,
  });
}
