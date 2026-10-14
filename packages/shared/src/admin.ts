/** Types shared between the admin API and the admin web app. No flags, ever. */
import type { EventMode, EventPhase, EventStatus } from './event';

export type AdminRole = 'admin' | 'viewer';

export interface AdminMe {
  username: string;
  role: AdminRole;
}

export interface AdminSessionResponse {
  admin: AdminMe | null;
  csrfToken: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

// --- Overview ----------------------------------------------------------------

export interface ServiceHealthRow {
  id: string;
  title: string;
  port: number | null;
  status: 'up' | 'starting' | 'down' | 'n/a';
}

export type FeedKind = 'join' | 'solve' | 'wrong' | 'admin';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  at: string;
  /** Human text, already free of any flag value. */
  text: string;
}

export interface AttentionItem {
  level: 'info' | 'warn';
  text: string;
}

export interface OverviewResponse {
  event: AdminEventState;
  totals: {
    players: number;
    activePlayers: number;
    solves: number;
    wrong: number;
  };
  perTeam: Array<{ teamId: string; teamName: string; players: number; score: number }>;
  solvesPerMission: Array<{ id: string; number: number; title: string; solves: number }>;
  services: ServiceHealthRow[];
  feed: FeedItem[];
  attention: AttentionItem[];
}

// --- Event -------------------------------------------------------------------

export interface AdminEventState {
  name: string;
  mode: EventMode;
  phase: EventPhase;
  status: EventStatus;
  startedAt: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  remainingMs: number;
  serverNow: number;
  leaderboardFrozen: boolean;
  freezeAt: string | null;
  freezeMinutesBeforeEnd: number | null;
  maintenance: boolean;
}

// --- Missions ----------------------------------------------------------------

export interface AdminMissionRow {
  id: string;
  number: number;
  title: string;
  category: string;
  points: number;
  difficulty: number;
  released: boolean;
  releaseAt: string | null;
  port: number | null;
  serviceStatus: 'up' | 'starting' | 'down' | 'n/a';
  restarts: number;
  solves: number;
  wrong: number;
  firstSolveAt: string | null;
}

// --- Players -----------------------------------------------------------------

export type PlayerStatus = 'active' | 'banned';

export interface AdminPlayerRow {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  ip: string | null;
  joinedAt: string;
  lastSeenAt: string | null;
  score: number;
  solves: number;
  wrong: number;
  status: PlayerStatus;
}

export interface PlayerTimelineItem {
  at: string;
  kind: 'join' | 'solve' | 'wrong' | 'admin';
  text: string;
}

export interface AdminPlayerDetail extends AdminPlayerRow {
  bannedReason: string | null;
  adjustments: Array<{ id: string; points: number; reason: string; admin: string; at: string; reversed: boolean }>;
  timeline: PlayerTimelineItem[];
}

// --- Submissions -------------------------------------------------------------

export interface AdminSubmissionRow {
  id: string;
  at: string;
  playerName: string;
  teamName: string;
  missionNumber: number;
  missionTitle: string;
  correct: boolean;
  ip: string;
  /** Wrong-submission text (admins only). Null for correct submissions. */
  text: string | null;
  /** The challenge id whose flag this wrong text matches, if any. */
  matchesMissionId: string | null;
}

// --- Leaderboard (admin: always live) ---------------------------------------

export interface AdminLeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  teamName: string;
  score: number;
  solvePoints: number;
  adjustmentPoints: number;
  flags: number;
  wrong: number;
}

// --- Announcements -----------------------------------------------------------

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

/** The banner shape the player site reads. */
export interface PlayerAnnouncement {
  id: string;
  title: string;
  body: string;
}

// --- Settings ----------------------------------------------------------------

export interface AdminSettings {
  signupLocked: boolean;
  maintenance: boolean;
  cooldownSeconds: number;
  newPlayersPerIp: number;
  maxPlayersPerTeam: number;
  timezone: string | null;
}

// --- Audit -------------------------------------------------------------------

export interface AuditRow {
  id: string;
  admin: string;
  action: string;
  target: string | null;
  before: string | null;
  after: string | null;
  ip: string | null;
  at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Shown on the player site when maintenance is on or the account is banned. */
export const MAINTENANCE_MESSAGE = 'The platform is briefly offline for maintenance. Back soon.';
export const SIGNUP_CLOSED_MESSAGE = 'Registration is closed. Ask an event organizer.';
