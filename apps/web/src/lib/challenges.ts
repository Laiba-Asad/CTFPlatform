import type { ChallengesResponse, SubmitResponse } from '@cydemic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { queryKeys } from './auth';

const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 12000);

export function useChallenges() {
  return useQuery({
    queryKey: ['challenges'],
    queryFn: () => api<ChallengesResponse>('/challenges'),
    refetchInterval: POLL_MS,
  });
}

export function useSubmitFlag(challengeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (flag: string) =>
      api<SubmitResponse>(`/challenges/${challengeId}/submit`, { method: 'POST', body: { flag } }),
    onSuccess: (res) => {
      if (res.outcome === 'correct' || res.outcome === 'already_solved') {
        void qc.invalidateQueries({ queryKey: ['challenges'] });
        void qc.invalidateQueries({ queryKey: queryKeys.me });
      }
    },
  });
}

/** Target URL of a web challenge, built from the host the player is on + the port. */
export function targetUrl(port: number | null): string | null {
  if (!port) return null;
  return `${window.location.protocol}//${window.location.hostname}:${port}/`;
}

export function attachmentUrl(challengeId: string): string {
  return `/api/challenges/${challengeId}/attachment`;
}
