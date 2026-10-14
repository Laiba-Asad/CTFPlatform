import type {
  AdminEventState,
  AdminLeaderboardRow,
  AdminMissionRow,
  AdminPlayerDetail,
  AdminPlayerRow,
  AdminSessionResponse,
  AdminSettings,
  AdminSubmissionRow,
  AnnouncementRow,
  AuditRow,
  OverviewResponse,
  Paginated,
} from '@cydemic/shared';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { adminApi } from './adminApi';

export const adminKeys = {
  session: ['admin', 'session'] as const,
  overview: ['admin', 'overview'] as const,
  event: ['admin', 'event'] as const,
  missions: ['admin', 'missions'] as const,
  players: (q: string) => ['admin', 'players', q] as const,
  player: (id: string) => ['admin', 'player', id] as const,
  teams: ['admin', 'teams'] as const,
  submissions: (q: string) => ['admin', 'submissions', q] as const,
  leaderboard: ['admin', 'leaderboard'] as const,
  announcements: ['admin', 'announcements'] as const,
  settings: ['admin', 'settings'] as const,
  admins: ['admin', 'admins'] as const,
  audit: (q: string) => ['admin', 'audit', q] as const,
  backups: ['admin', 'backups'] as const,
};

const POLL = 12_000;

// --- Session / auth -----------------------------------------------------------

export function useAdminSession() {
  return useQuery({
    queryKey: adminKeys.session,
    queryFn: () => adminApi<AdminSessionResponse>('/auth/session'),
    staleTime: 30_000,
    retry: 3,
  });
}

export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string }) => adminApi<AdminSessionResponse>('/auth/login', { method: 'POST', body }),
    onSuccess: (data) => {
      qc.setQueryData(adminKeys.session, data);
      void qc.invalidateQueries();
    },
  });
}

export function useAdminLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi<AdminSessionResponse>('/auth/logout', { method: 'POST' }),
    onSuccess: (data) => {
      qc.clear();
      qc.setQueryData(adminKeys.session, data);
    },
  });
}

// --- Reads --------------------------------------------------------------------

export function useOverview() {
  return useQuery({ queryKey: adminKeys.overview, queryFn: () => adminApi<OverviewResponse>('/overview'), refetchInterval: POLL });
}
export function useAdminEvent() {
  return useQuery({ queryKey: adminKeys.event, queryFn: () => adminApi<AdminEventState>('/event'), refetchInterval: POLL });
}
export function useMissions() {
  return useQuery({ queryKey: adminKeys.missions, queryFn: () => adminApi<{ missions: AdminMissionRow[] }>('/missions'), refetchInterval: POLL });
}
export function usePlayers(query: string) {
  return useQuery({ queryKey: adminKeys.players(query), queryFn: () => adminApi<Paginated<AdminPlayerRow>>(`/players${query}`), refetchInterval: POLL });
}
export function usePlayer(id: string | null) {
  return useQuery({ queryKey: adminKeys.player(id ?? ''), queryFn: () => adminApi<AdminPlayerDetail>(`/players/${id}`), enabled: !!id });
}
export interface AdminTeamRow {
  id: string;
  name: string;
  avatar: string;
  playerCap: number | null;
  joinLocked: boolean;
  members: number;
  score: number;
  solves: number;
}
export function useTeams() {
  return useQuery({ queryKey: adminKeys.teams, queryFn: () => adminApi<{ teams: AdminTeamRow[] }>('/teams'), refetchInterval: POLL });
}
export function useSubmissions(query: string) {
  return useQuery({ queryKey: adminKeys.submissions(query), queryFn: () => adminApi<Paginated<AdminSubmissionRow>>(`/submissions${query}`), refetchInterval: POLL });
}
export function useAdminLeaderboard() {
  return useQuery({ queryKey: adminKeys.leaderboard, queryFn: () => adminApi<{ players: AdminLeaderboardRow[] }>('/leaderboard'), refetchInterval: POLL });
}
export function useAnnouncements() {
  return useQuery({ queryKey: adminKeys.announcements, queryFn: () => adminApi<{ announcements: AnnouncementRow[] }>('/announcements') });
}
export function useSettings() {
  return useQuery({ queryKey: adminKeys.settings, queryFn: () => adminApi<AdminSettings>('/settings') });
}
export interface AdminAccountRow {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
  disabled: boolean;
  lastLoginAt: string | null;
}
export function useAdmins() {
  return useQuery({ queryKey: adminKeys.admins, queryFn: () => adminApi<{ admins: AdminAccountRow[] }>('/settings/admins') });
}
export function useAudit(query: string) {
  return useQuery({ queryKey: adminKeys.audit(query), queryFn: () => adminApi<Paginated<AuditRow>>(`/audit${query}`), refetchInterval: POLL });
}
export function useBackups() {
  return useQuery({ queryKey: adminKeys.backups, queryFn: () => adminApi<{ backups: string[]; restoreHint: string }>('/settings/backups') });
}

// --- Generic mutation helper --------------------------------------------------

/** A mutation that invalidates the given query keys on success. */
export function useAdminMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  invalidate: QueryKey[] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of invalidate) void qc.invalidateQueries({ queryKey: key });
    },
  });
}
