import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { getEventState } from './event';

export interface EffectiveSettings {
  signupLocked: boolean;
  maintenance: boolean;
  cooldownSeconds: number;
  newPlayersPerIp: number;
  maxPlayersPerTeam: number;
  timezone: string | null;
  leaderboardFrozen: boolean;
  freezeAt: Date | null;
  freezeMinutesBeforeEnd: number | null;
}

/**
 * Load the singleton Settings row, creating it with defaults if missing.
 * Uses an upsert so concurrent callers (e.g. /state loads settings twice in
 * parallel) can't race to create the row and hit a unique-constraint error.
 */
export async function getSettingsRow(db: Db) {
  return db.settings.upsert({ where: { id: 'main' }, create: { id: 'main' }, update: {} });
}

/** Settings merged with env defaults (DB value wins when set). */
export async function getEffectiveSettings(db: Db, config: AppConfig): Promise<EffectiveSettings> {
  const s = await getSettingsRow(db);
  return {
    signupLocked: s.signupLocked,
    maintenance: s.maintenance,
    cooldownSeconds: s.cooldownSeconds ?? Math.round(config.rateLimits.cooldownMs / 1000),
    newPlayersPerIp: s.newPlayersPerIp ?? config.login.newPlayersPerIp.max,
    maxPlayersPerTeam: s.maxPlayersPerTeam ?? config.login.maxPlayersPerTeam,
    timezone: s.timezone ?? null,
    leaderboardFrozen: s.leaderboardFrozen,
    freezeAt: s.freezeAt,
    freezeMinutesBeforeEnd: s.freezeMinutesBeforeEnd,
  };
}

export interface FreezeState {
  frozen: boolean;
  /** Snapshot time the frozen leaderboard reflects (null when live). */
  asOf: Date | null;
}

/**
 * Whether the leaderboard is frozen right now, and the snapshot time it shows.
 * Frozen either manually (leaderboardFrozen) or automatically in the last
 * `freezeMinutesBeforeEnd` minutes of the event.
 */
export async function getFreezeState(db: Db, config: AppConfig): Promise<FreezeState> {
  const s = await getEffectiveSettings(db, config);
  if (s.leaderboardFrozen) return { frozen: true, asOf: s.freezeAt ?? new Date() };
  if (s.freezeMinutesBeforeEnd != null) {
    const event = await getEventState(db);
    const freezeStart = event.endsAt.getTime() - s.freezeMinutesBeforeEnd * 60_000;
    if (Date.now() >= freezeStart && event.phase !== 'ended') return { frozen: true, asOf: new Date(freezeStart) };
  }
  return { frozen: false, asOf: null };
}
