import type { LoginRequest, MeResponse, SessionResponse } from '@cydemic/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const queryKeys = {
  session: ['session'] as const,
  me: ['me'] as const,
  features: ['features'] as const,
  event: ['event'] as const,
};

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => api<SessionResponse>('/auth/session'),
    staleTime: 60_000,
    // Keep retrying a short time so a slow/starting API recovers on its own.
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export interface Features {
  intel: boolean;
  achievements: boolean;
}

export function useFeatures() {
  return useQuery({
    queryKey: queryKeys.features,
    queryFn: () => api<Features>('/features'),
    staleTime: 5 * 60_000,
    // Default to everything off if the API is unreachable (hide empty sections).
    placeholderData: { intel: false, achievements: false },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => api<SessionResponse>('/auth/login', { method: 'POST', body }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.session, data);
      void qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<SessionResponse>('/auth/logout', { method: 'POST' }),
    onSuccess: (data) => {
      qc.clear();
      qc.setQueryData(queryKeys.session, data);
    },
  });
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api<MeResponse>('/me') });
}
