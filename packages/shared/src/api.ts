/** JSON shapes exchanged between the API and the web app. */

export type Role = 'player' | 'admin';

export interface TeamPublic {
  id: string;
  name: string;
  /** Path to the team badge, e.g. /avatars/<team-id>.png. May not exist yet. */
  avatar: string;
  tagline: string;
}

export interface SessionUser {
  id: string;
  /** The name exactly as the player entered it */
  name: string;
  role: Role;
  team: TeamPublic;
}

export interface SessionResponse {
  user: SessionUser | null;
  csrfToken: string;
  /** True when the cookie belongs to a banned player (show the banned message). */
  banned?: boolean;
  bannedReason?: string | null;
}

export const BANNED_MESSAGE = 'Your access to the event has been removed. Ask an event organizer.';

export interface LoginRequest {
  name: string;
  teamId: string;
}

export interface EventResponse {
  name: string;
  startsAt: string;
  endsAt: string;
  mode: import('./event').EventMode;
  /** The phase the server computed from mode + dates right now. */
  phase: import('./event').EventPhase;
  /** Shared-clock status: waiting | live | paused | ended. */
  status: import('./event').EventStatus;
  /** When the shared event was started (null while waiting). */
  startedAt: string | null;
  /** Time left on the shared clock right now (frozen while paused). */
  remainingMs: number;
  /** Number of players currently signed in (for the waiting screen). */
  playersPresent: number;
  /** Server clock (epoch ms) for client offset correction */
  serverNow: number;
}

export interface SolvedMission {
  challengeId: string;
  number: number;
  title: string;
  category: string;
  points: number;
  solvedAt: string;
}

export interface PlayerStats {
  /** Null until the player has scored */
  rank: number | null;
  score: number;
  flagsCaptured: number;
  totalChallenges: number;
}

export interface MeResponse {
  user: SessionUser;
  stats: PlayerStats;
  solved: SolvedMission[];
}

export interface ChallengeCard {
  id: string;
  number: number;
  title: string;
  category: string;
  points: number;
  state: import('./types').MissionState;
  solves: number;
  /** Web challenges only: the port the target service listens on. */
  port: number | null;
  /** True when a downloadable capture exists (net challenges). */
  hasFile: boolean;
  /** Hidden (null) until the challenge is open to this player. */
  description: string | null;
}

export interface ChallengesResponse {
  challenges: ChallengeCard[];
  /** Whether flag submission is currently allowed (event live). */
  acceptingSubmissions: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  teamId: string;
  teamName: string;
  avatar: string;
  score: number;
  flags: number;
  isYou?: boolean;
}

export interface TeamLeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  avatar: string;
  score: number;
  flags: number;
  members: number;
  isYours?: boolean;
}

export interface ScorePoint {
  /** ISO timestamp */
  t: string;
  score: number;
}

export interface LeaderboardSeries {
  name: string;
  isYou?: boolean;
  points: ScorePoint[];
}

export interface LeaderboardResponse {
  players: LeaderboardEntry[];
  teams: TeamLeaderboardEntry[];
  /** Score-over-time for the top players (for the chart). */
  series: LeaderboardSeries[];
  /** True when the player view is frozen (shown with a "Frozen" label). */
  frozen: boolean;
}

/** Player-site live state: announcement banner, maintenance, frozen flag. */
export interface PlayerStateResponse {
  maintenance: boolean;
  leaderboardFrozen: boolean;
  announcement: import('./admin').PlayerAnnouncement | null;
}

export type SubmitOutcome = 'correct' | 'incorrect' | 'already_solved';

export interface SubmitResponse {
  outcome: SubmitOutcome;
  pointsAwarded?: number;
  /** Wrong attempts counted against this challenge in the current window. */
  attempts?: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> & { retryAfterSeconds?: number };
  };
}
