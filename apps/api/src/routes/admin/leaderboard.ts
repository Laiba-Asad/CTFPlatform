import type { AdminLeaderboardRow } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { reqParam } from '../../lib/req';
import { requireAdminRole } from '../../middleware/admin-auth';
import { auditFromReq } from '../../services/audit';
import { aggregatePlayers, rankPlayers } from '../../services/scoring';
import type { AdminDeps } from './index';

const AdjustBody = z.object({ userId: z.string().min(1), points: z.number().int().refine((p) => p !== 0, 'points must be non-zero'), reason: z.string().min(1).max(200) });

export function leaderboardAdminRouter({ db }: AdminDeps) {
  const router = Router();

  // Admins always see live, unfrozen data.
  router.get('/', async (_req, res) => {
    const ranked = rankPlayers(await aggregatePlayers(db));
    const rows: AdminLeaderboardRow[] = ranked.map((a, i) => ({
      rank: i + 1,
      userId: a.id,
      name: a.name,
      teamName: a.teamName,
      score: a.score,
      solvePoints: a.solvePoints,
      adjustmentPoints: a.adjustmentPoints,
      flags: a.flags,
      wrong: a.wrong,
    }));
    res.set('Cache-Control', 'no-store').json({ players: rows });
  });

  router.post('/adjustments', requireAdminRole, async (req, res) => {
    const { userId, points, reason } = AdjustBody.parse(req.body);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'player') throw new HttpError(404, 'NOT_FOUND', 'Player not found');
    const adj = await db.scoreAdjustment.create({ data: { userId, points, reason, admin: req.admin!.username } });
    await auditFromReq(db, req, 'score.adjust', { target: user.name, after: { points, reason } });
    res.json({ id: adj.id });
  });

  router.post('/adjustments/:id/reverse', requireAdminRole, async (req, res) => {
    const adj = await db.scoreAdjustment.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!adj) throw new HttpError(404, 'NOT_FOUND', 'Adjustment not found');
    if (adj.reversedAt) throw new HttpError(409, 'ALREADY_REVERSED', 'Already reversed');
    await db.scoreAdjustment.update({ where: { id: adj.id }, data: { reversedAt: new Date(), reversedBy: req.admin!.username } });
    await auditFromReq(db, req, 'score.adjust.reverse', { target: adj.userId, before: { points: adj.points } });
    res.json({ id: adj.id, reversed: true });
  });

  // Scores are always derived from solves + adjustments, so there is nothing to
  // rebuild; this returns the current derived standings to confirm (empty diff).
  router.get('/recompute', async (_req, res) => {
    const ranked = rankPlayers(await aggregatePlayers(db));
    res.json({
      diff: [],
      note: 'Scores are always derived from solve records plus adjustments; totals cannot drift. Current standings shown for confirmation.',
      standings: ranked.map((a, i) => ({ rank: i + 1, name: a.name, score: a.score })),
    });
  });

  return router;
}
