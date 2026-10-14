import type { PlayerStateResponse } from '@cydemic/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 12000);

/**
 * Live player-site state: maintenance switch, frozen leaderboard and the active
 * announcement banner. Polled so organizer changes appear within a few seconds.
 */
export function usePlayerState() {
  return useQuery({
    queryKey: ['player-state'],
    queryFn: () => api<PlayerStateResponse>('/state'),
    refetchInterval: POLL_MS,
    staleTime: 5_000,
  });
}
