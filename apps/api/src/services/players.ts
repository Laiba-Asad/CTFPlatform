import { nameKey } from '@cydemic/shared';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';

export type LoginResolution =
  | { kind: 'signed_in'; user: UserWithTeam }
  | { kind: 'created'; user: UserWithTeam }
  | { kind: 'different_team' }
  | { kind: 'name_unavailable' }
  | { kind: 'team_full' }
  | { kind: 'team_locked' }
  | { kind: 'rate_limited' };

export interface UserWithTeam {
  id: string;
  name: string;
  role: string;
  teamId: string;
  team: { id: string; name: string; avatar: string; tagline: string };
}

/**
 * Open-join login: the first time a name is used it creates the player on the
 * chosen team; afterwards the same name signs back into the same account.
 *
 * - same name + same team  -> sign in to the existing account
 * - same name + other team -> rejected (names are unique across teams)
 * - admin names             -> not usable here (cannot impersonate an admin)
 * Names are compared case/space/accent-insensitively via nameKey.
 */
export async function resolveLogin(
  db: Db,
  config: AppConfig,
  params: { name: string; teamId: string; ip: string; allowCreate: () => boolean; maxPlayersPerTeam?: number },
): Promise<LoginResolution> {
  const key = nameKey(params.name);
  const existing = await db.user.findUnique({ where: { nameKey: key }, include: { team: true } });

  if (existing) {
    if (existing.role !== 'player') return { kind: 'name_unavailable' };
    if (existing.teamId !== params.teamId) return { kind: 'different_team' };
    return { kind: 'signed_in', user: existing };
  }

  // New player: honour this team's join-lock and the per-team cap, then the per-IP rate.
  const team = await db.team.findUnique({ where: { id: params.teamId } });
  if (team?.joinLocked) return { kind: 'team_locked' };
  // Per-team cap overrides the global default; 0/undefined = unlimited.
  const max = team?.playerCap ?? params.maxPlayersPerTeam ?? config.login.maxPlayersPerTeam;
  if (max > 0) {
    const count = await db.user.count({ where: { teamId: params.teamId, role: 'player' } });
    if (count >= max) return { kind: 'team_full' };
  }
  if (!params.allowCreate()) return { kind: 'rate_limited' };

  try {
    const user = await db.user.create({
      data: { name: params.name, nameKey: key, teamId: params.teamId, role: 'player', createdIp: params.ip },
      include: { team: true },
    });
    return { kind: 'created', user };
  } catch {
    // Unique-constraint race: another request created this name first. Re-resolve.
    const now = await db.user.findUnique({ where: { nameKey: key }, include: { team: true } });
    if (now && now.role === 'player' && now.teamId === params.teamId) return { kind: 'signed_in', user: now };
    if (now && now.role !== 'player') return { kind: 'name_unavailable' };
    return { kind: 'different_team' };
  }
}
