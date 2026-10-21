import { type AdminMissionRow, compareMissions } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { reqParam } from '../../lib/req';
import { requireAdminRole } from '../../middleware/admin-auth';
import { auditFromReq } from '../../services/audit';
import type { AdminDeps, AdminSupervisor } from './index';
import type { Db } from '../../lib/db';

const EditBody = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(4000).optional(),
  points: z.number().int().min(0).max(100000).optional(),
});
const ReleaseBody = z.object({ released: z.boolean(), releaseAt: z.string().datetime({ offset: true }).nullable().optional() });

function serviceStatusOf(sup: AdminSupervisor | undefined, c: { id: string; port: number | null }): AdminMissionRow['serviceStatus'] {
  if (!c.port) return 'n/a';
  if (!sup?.supervising) return 'n/a';
  return sup.serviceStatus(c.id);
}

async function rows(db: Db, sup: AdminSupervisor | undefined): Promise<AdminMissionRow[]> {
  const [challenges, solveGroups, wrongGroups, firstSolves] = await Promise.all([
    db.challenge.findMany(),
    db.solve.groupBy({ by: ['challengeId'], _count: { _all: true } }),
    db.submission.groupBy({ by: ['challengeId'], where: { correct: false }, _count: { _all: true } }),
    db.solve.groupBy({ by: ['challengeId'], _min: { createdAt: true } }),
  ]);
  const solves = new Map(solveGroups.map((g) => [g.challengeId, g._count._all]));
  const wrong = new Map(wrongGroups.map((g) => [g.challengeId, g._count._all]));
  const first = new Map(firstSolves.map((g) => [g.challengeId, g._min.createdAt]));
  // Board order (points, then id); the number is the position, never stored.
  return [...challenges].sort(compareMissions).map((c, index) => ({
    id: c.id,
    number: index + 1,
    title: c.title,
    category: c.category,
    points: c.points,
    released: c.released,
    releaseAt: c.releaseAt?.toISOString() ?? null,
    port: c.port ?? null,
    serviceStatus: serviceStatusOf(sup, c),
    restarts: c.port && sup?.supervising ? sup.restartsOf(c.id) : 0,
    solves: solves.get(c.id) ?? 0,
    wrong: wrong.get(c.id) ?? 0,
    firstSolveAt: first.get(c.id)?.toISOString() ?? null,
  }));
}

export function missionsAdminRouter({ db, supervisor }: AdminDeps) {
  const router = Router();

  router.get('/', async (_req, res) => res.set('Cache-Control', 'no-store').json({ missions: await rows(db, supervisor) }));

  router.get('/:id/solvers', async (req, res) => {
    const solves = await db.solve.findMany({ where: { challengeId: reqParam(req, 'id') }, orderBy: { createdAt: 'asc' }, include: { user: { include: { team: true } } } });
    res.json({ solvers: solves.map((s) => ({ name: s.user.name, team: s.user.team.name, at: s.createdAt.toISOString() })) });
  });

  router.post('/:id/release', requireAdminRole, async (req, res) => {
    const body = ReleaseBody.parse(req.body);
    const challenge = await db.challenge.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!challenge) throw new HttpError(404, 'NOT_FOUND', 'Challenge not found');
    await db.challenge.update({ where: { id: challenge.id }, data: { released: body.released, releaseAt: body.releaseAt ? new Date(body.releaseAt) : null } });
    if (supervisor && challenge.port) {
      if (body.released) await supervisor.start(challenge.id, challenge.port);
      else await supervisor.stop(challenge.id);
    }
    await auditFromReq(db, req, 'mission.release', { target: challenge.id, before: { released: challenge.released }, after: { released: body.released } });
    res.json({ id: challenge.id, released: body.released });
  });

  router.post('/release-all', requireAdminRole, async (req, res) => {
    const all = await db.challenge.findMany();
    await db.challenge.updateMany({ data: { released: true } });
    if (supervisor) for (const c of all) if (c.port) await supervisor.start(c.id, c.port);
    await auditFromReq(db, req, 'mission.release_all', { after: { released: true, count: all.length } });
    res.json({ ok: true });
  });

  router.post('/lock-all', requireAdminRole, async (req, res) => {
    const all = await db.challenge.findMany();
    await db.challenge.updateMany({ data: { released: false } });
    if (supervisor) for (const c of all) if (c.port) await supervisor.stop(c.id);
    await auditFromReq(db, req, 'mission.lock_all', { after: { released: false, count: all.length } });
    res.json({ ok: true });
  });

  router.post('/:id/service/:action', requireAdminRole, async (req, res) => {
    const action = reqParam(req, 'action');
    if (!['start', 'stop', 'restart'].includes(action)) throw new HttpError(400, 'BAD_ACTION', 'Unknown action');
    const challenge = await db.challenge.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!challenge || !challenge.port) throw new HttpError(404, 'NOT_FOUND', 'No service for this challenge');
    if (supervisor) {
      if (action === 'start') await supervisor.start(challenge.id, challenge.port);
      else if (action === 'stop') await supervisor.stop(challenge.id);
      else await supervisor.restart(challenge.id, challenge.port);
    }
    await auditFromReq(db, req, `mission.service.${action}`, { target: challenge.id });
    res.json({ id: challenge.id, action });
  });

  // Editing points recomputes scores from solve records automatically (scores
  // are always derived), so we only change the challenge definition here.
  router.patch('/:id', requireAdminRole, async (req, res) => {
    const body = EditBody.parse(req.body);
    const challenge = await db.challenge.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!challenge) throw new HttpError(404, 'NOT_FOUND', 'Challenge not found');
    const data: Record<string, unknown> = {};
    for (const k of ['title', 'description', 'points'] as const) if (body[k] !== undefined) data[k] = body[k];
    if (body.points !== undefined && body.points !== challenge.points) {
      // Update the points stored on existing solves so derived scores reflect the new value.
      await db.solve.updateMany({ where: { challengeId: challenge.id }, data: { points: body.points } });
    }
    const updated = await db.challenge.update({ where: { id: challenge.id }, data });
    await auditFromReq(db, req, 'mission.edit', {
      target: challenge.id,
      before: { title: challenge.title, points: challenge.points },
      after: { title: updated.title, points: updated.points },
    });
    res.json({ id: challenge.id });
  });

  return router;
}
