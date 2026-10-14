import { Router } from 'express';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { getLeaderboard } from '../services/leaderboard';
import { getFreezeState } from '../services/settings';

/**
 * Leaderboard for players and teams, with a score-over-time series. Cached for a
 * few seconds so frequent polling (every 12-15s per client) stays cheap, and
 * frozen-but-viewable after the event ends (the data simply stops changing).
 */
export function leaderboardRouter(db: Db, config: AppConfig) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    // Players see a frozen snapshot when the organizer freezes the board.
    const freeze = await getFreezeState(db, config);
    const body = await getLeaderboard(db, config, {
      viewerId: req.user!.id,
      asOf: freeze.asOf ?? undefined,
      frozen: freeze.frozen,
    });
    res.set('Cache-Control', 'private, max-age=5').json(body);
  });

  return router;
}
