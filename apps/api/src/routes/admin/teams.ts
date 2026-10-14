import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { reqParam } from '../../lib/req';
import { requireAdminRole } from '../../middleware/admin-auth';
import { auditFromReq } from '../../services/audit';
import { aggregatePlayers } from '../../services/scoring';
import type { AdminDeps } from './index';

const ControlsBody = z.object({ playerCap: z.number().int().min(0).nullable().optional(), joinLocked: z.boolean().optional() });

export function teamsAdminRouter({ db, config }: AdminDeps) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const [teams, aggs] = await Promise.all([db.team.findMany({ orderBy: { name: 'asc' } }), aggregatePlayers(db)]);
    const perTeam = new Map<string, { score: number; flags: number; members: number }>();
    for (const a of aggs) {
      const t = perTeam.get(a.teamId) ?? { score: 0, flags: 0, members: 0 };
      t.members += 1;
      t.flags += a.flags;
      if (config.scoring.team === 'unique') t.score = t.score; // computed below if needed
      else t.score += a.score;
      perTeam.set(a.teamId, t);
    }
    res.set('Cache-Control', 'no-store').json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        avatar: t.avatar,
        playerCap: t.playerCap,
        joinLocked: t.joinLocked,
        members: perTeam.get(t.id)?.members ?? 0,
        score: perTeam.get(t.id)?.score ?? 0,
        solves: perTeam.get(t.id)?.flags ?? 0,
      })),
    });
  });

  router.patch('/:id', requireAdminRole, async (req, res) => {
    const b = ControlsBody.parse(req.body);
    const team = await db.team.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!team) throw new HttpError(404, 'NOT_FOUND', 'Team not found');
    await db.team.update({
      where: { id: team.id },
      data: { ...(b.playerCap !== undefined && { playerCap: b.playerCap }), ...(b.joinLocked !== undefined && { joinLocked: b.joinLocked }) },
    });
    await auditFromReq(db, req, 'team.controls', { target: team.name, before: { playerCap: team.playerCap, joinLocked: team.joinLocked }, after: b });
    res.json({ id: team.id });
  });

  return router;
}
