import type { EventResponse, PlayerStateResponse, TeamPublic } from '@cydemic/shared';
import { Router } from 'express';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { getEventState } from '../services/event';
import { getEffectiveSettings, getFreezeState } from '../services/settings';
import { activePlayerAnnouncement } from '../services/announcements';

/** Data the login screen and the top bar need before or without a session. */
export function publicRouter(db: Db, config: AppConfig) {
  const router = Router();

  router.get('/teams', async (_req, res) => {
    const teams = await db.team.findMany({ orderBy: { name: 'asc' } });
    const body: TeamPublic[] = teams.map(({ id, name, avatar, tagline }) => ({ id, name, avatar, tagline }));
    res.json(body);
  });

  // Which optional sections are enabled (so the sidebar hides empty ones).
  router.get('/features', (_req, res) => {
    res.json({ intel: config.features.intel, achievements: config.features.achievements });
  });

  // Live player-site state: maintenance, frozen leaderboard, announcement banner.
  router.get('/state', async (_req, res) => {
    const [settings, freeze, announcement] = await Promise.all([
      getEffectiveSettings(db, config),
      getFreezeState(db, config),
      activePlayerAnnouncement(db),
    ]);
    const body: PlayerStateResponse = {
      maintenance: settings.maintenance,
      leaderboardFrozen: freeze.frozen,
      announcement,
    };
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.get('/event', async (_req, res) => {
    const twoMinAgo = new Date(Date.now() - 2 * 60_000);
    const [state, playersPresent] = await Promise.all([
      getEventState(db),
      db.user.count({ where: { role: 'player', lastSeenAt: { gte: twoMinAgo } } }),
    ]);
    const body: EventResponse = {
      name: state.name,
      startsAt: state.startsAt.toISOString(),
      endsAt: state.endsAt.toISOString(),
      mode: state.mode,
      phase: state.phase,
      status: state.status,
      startedAt: state.startedAt?.toISOString() ?? null,
      remainingMs: state.remainingMs,
      playersPresent,
      serverNow: state.now,
    };
    res.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}
