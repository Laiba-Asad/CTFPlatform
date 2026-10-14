import type { MeResponse } from '@cydemic/shared';
import { Router } from 'express';
import type { Db } from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { getPlayerStats, getSolvedMissions } from '../services/stats';

/** The signed-in player's own data. Players can only ever read themselves here. */
export function meRouter(db: Db) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const user = req.user!;
    const [stats, solved] = await Promise.all([getPlayerStats(db, user.id), getSolvedMissions(db, user.id)]);
    const body: MeResponse = { user, stats, solved };
    res.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}
