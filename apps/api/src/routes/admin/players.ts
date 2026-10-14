import { BANNED_MESSAGE, nameKey, validateName, type AdminPlayerDetail, type AdminPlayerRow } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { backupSqlite } from '../../lib/backup';
import { HttpError } from '../../lib/http-error';
import { reqParam } from '../../lib/req';
import { requireAdminRole } from '../../middleware/admin-auth';
import { auditFromReq } from '../../services/audit';
import { aggregatePlayers } from '../../services/scoring';
import type { AdminDeps } from './index';
import type { Db } from '../../lib/db';

const ListQuery = z.object({
  q: z.string().optional(),
  teamId: z.string().optional(),
  status: z.enum(['active', 'banned']).optional(),
  sort: z.enum(['score', 'name', 'joined', 'lastSeen', 'wrong']).default('score'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
const BanBody = z.object({ reason: z.string().max(200).optional() });
const RenameBody = z.object({ name: z.string().min(2).max(40) });
const MoveBody = z.object({ teamId: z.string().min(1) });
const MergeBody = z.object({ fromId: z.string().min(1), toId: z.string().min(1) });

export function playersAdminRouter({ db, config }: AdminDeps) {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = ListQuery.parse(req.query);
    const aggs = await aggregatePlayers(db);
    const scoreById = new Map(aggs.map((a) => [a.id, a]));
    const users = await db.user.findMany({ where: { role: 'player' }, include: { team: true } });

    let rows: AdminPlayerRow[] = users.map((u) => {
      const a = scoreById.get(u.id);
      return {
        id: u.id,
        name: u.name,
        teamId: u.teamId,
        teamName: u.team.name,
        ip: u.createdIp ?? null,
        joinedAt: u.createdAt.toISOString(),
        lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
        score: a?.score ?? 0,
        solves: a?.flags ?? 0,
        wrong: a?.wrong ?? 0,
        status: (u.status as 'active' | 'banned') ?? 'active',
      };
    });

    if (q.q) rows = rows.filter((r) => r.name.toLowerCase().includes(q.q!.toLowerCase()));
    if (q.teamId) rows = rows.filter((r) => r.teamId === q.teamId);
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    rows.sort((x, y) => {
      switch (q.sort) {
        case 'name': return x.name.localeCompare(y.name);
        case 'joined': return x.joinedAt.localeCompare(y.joinedAt);
        case 'lastSeen': return (y.lastSeenAt ?? '').localeCompare(x.lastSeenAt ?? '');
        case 'wrong': return y.wrong - x.wrong;
        default: return y.score - x.score;
      }
    });
    const total = rows.length;
    const start = (q.page - 1) * q.pageSize;
    res.set('Cache-Control', 'no-store').json({ items: rows.slice(start, start + q.pageSize), total, page: q.page, pageSize: q.pageSize });
  });

  router.get('/:id', async (req, res) => {
    const detail = await playerDetail(db, reqParam(req, 'id'));
    if (!detail) throw new HttpError(404, 'NOT_FOUND', 'Player not found');
    res.json(detail);
  });

  router.post('/:id/ban', requireAdminRole, async (req, res) => {
    const { reason } = BanBody.parse(req.body);
    const user = await requirePlayer(db, reqParam(req, 'id'));
    await db.user.update({ where: { id: user.id }, data: { status: 'banned', bannedReason: reason ?? null } });
    await db.session.deleteMany({ where: { userId: user.id } }); // force sign-out now
    await auditFromReq(db, req, 'player.ban', { target: user.name, after: { reason: reason ?? null } });
    res.json({ id: user.id, status: 'banned', message: BANNED_MESSAGE });
  });

  router.post('/:id/unban', requireAdminRole, async (req, res) => {
    const user = await requirePlayer(db, reqParam(req, 'id'));
    await db.user.update({ where: { id: user.id }, data: { status: 'active', bannedReason: null } });
    await auditFromReq(db, req, 'player.unban', { target: user.name });
    res.json({ id: user.id, status: 'active' });
  });

  router.post('/:id/force-logout', requireAdminRole, async (req, res) => {
    const user = await requirePlayer(db, reqParam(req, 'id'));
    await db.session.deleteMany({ where: { userId: user.id } });
    await auditFromReq(db, req, 'player.force_logout', { target: user.name });
    res.json({ ok: true });
  });

  router.post('/:id/rename', requireAdminRole, async (req, res) => {
    const { name } = RenameBody.parse(req.body);
    if (validateName(name)) throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid name');
    const user = await requirePlayer(db, reqParam(req, 'id'));
    const key = nameKey(name);
    const clash = await db.user.findUnique({ where: { nameKey: key } });
    if (clash && clash.id !== user.id) throw new HttpError(409, 'NAME_TAKEN', 'Another player already uses that name.');
    await db.user.update({ where: { id: user.id }, data: { name, nameKey: key } });
    await auditFromReq(db, req, 'player.rename', { target: user.id, before: { name: user.name }, after: { name } });
    res.json({ id: user.id, name });
  });

  router.post('/:id/move', requireAdminRole, async (req, res) => {
    const { teamId } = MoveBody.parse(req.body);
    const [user, team] = await Promise.all([requirePlayer(db, reqParam(req, 'id')), db.team.findUnique({ where: { id: teamId } })]);
    if (!team) throw new HttpError(400, 'UNKNOWN_TEAM', 'Unknown team');
    await db.user.update({ where: { id: user.id }, data: { teamId } });
    await auditFromReq(db, req, 'player.move', { target: user.name, before: { teamId: user.teamId }, after: { teamId } });
    res.json({ id: user.id, teamId });
  });

  router.post('/:id/reset', requireAdminRole, async (req, res) => {
    const user = await requirePlayer(db, reqParam(req, 'id'));
    await db.$transaction([
      db.solve.deleteMany({ where: { userId: user.id } }),
      db.submission.deleteMany({ where: { userId: user.id } }),
      db.scoreAdjustment.deleteMany({ where: { userId: user.id } }),
    ]);
    await auditFromReq(db, req, 'player.reset', { target: user.name });
    res.json({ ok: true });
  });

  router.delete('/:id', requireAdminRole, async (req, res) => {
    const user = await requirePlayer(db, reqParam(req, 'id'));
    const confirm = z.object({ confirmName: z.string() }).parse(req.body ?? {});
    if (confirm.confirmName !== user.name) throw new HttpError(400, 'CONFIRM_REQUIRED', 'Type the exact player name to confirm.');
    await backupSqlite(config.databaseUrl, 10).catch(() => undefined);
    await db.user.delete({ where: { id: user.id } }); // cascades sessions, solves, submissions, adjustments
    await auditFromReq(db, req, 'player.delete', { target: user.name });
    res.json({ ok: true });
  });

  router.post('/merge', requireAdminRole, async (req, res) => {
    const { fromId, toId } = MergeBody.parse(req.body);
    if (fromId === toId) throw new HttpError(400, 'SAME_PLAYER', 'Pick two different players.');
    const [from, to] = await Promise.all([requirePlayer(db, fromId), requirePlayer(db, toId)]);
    const targetSolved = new Set((await db.solve.findMany({ where: { userId: to.id }, select: { challengeId: true } })).map((s) => s.challengeId));
    const fromSolves = await db.solve.findMany({ where: { userId: from.id } });
    await db.$transaction([
      // keep only solves for challenges the target hasn't solved
      ...fromSolves.filter((s) => targetSolved.has(s.challengeId)).map((s) => db.solve.delete({ where: { id: s.id } })),
      db.solve.updateMany({ where: { userId: from.id }, data: { userId: to.id } }),
      db.submission.updateMany({ where: { userId: from.id }, data: { userId: to.id } }),
      db.scoreAdjustment.updateMany({ where: { userId: from.id }, data: { userId: to.id } }),
      db.user.delete({ where: { id: from.id } }),
    ]);
    await auditFromReq(db, req, 'player.merge', { target: to.name, before: { from: from.name }, after: { into: to.name } });
    res.json({ ok: true, into: to.id });
  });

  return router;
}

async function requirePlayer(db: Db, id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.role !== 'player') throw new HttpError(404, 'NOT_FOUND', 'Player not found');
  return user;
}

async function playerDetail(db: Db, id: string): Promise<AdminPlayerDetail | null> {
  const user = await db.user.findUnique({ where: { id }, include: { team: true } });
  if (!user || user.role !== 'player') return null;
  const [solves, wrongs, adjustments, auditRows] = await Promise.all([
    db.solve.findMany({ where: { userId: id }, include: { challenge: true }, orderBy: { createdAt: 'asc' } }),
    db.submission.findMany({ where: { userId: id, correct: false }, include: { challenge: true }, orderBy: { createdAt: 'asc' } }),
    db.scoreAdjustment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
    db.auditLog.findMany({ where: { OR: [{ target: id }, { target: user.name }] }, orderBy: { createdAt: 'asc' } }),
  ]);
  const score = solves.reduce((s, x) => s + x.points, 0) + adjustments.filter((a) => !a.reversedAt).reduce((s, a) => s + a.points, 0);
  const timeline: AdminPlayerDetail['timeline'] = [
    { at: user.createdAt.toISOString(), kind: 'join' as const, text: `Joined ${user.team.name}` },
    ...solves.map((s) => ({ at: s.createdAt.toISOString(), kind: 'solve' as const, text: `Solved #${s.challenge.number} ${s.challenge.title} (+${s.points})` })),
    ...wrongs.map((w) => ({ at: w.createdAt.toISOString(), kind: 'wrong' as const, text: `Wrong flag on #${w.challenge.number} ${w.challenge.title}` })),
    ...auditRows.map((a) => ({ at: a.createdAt.toISOString(), kind: 'admin' as const, text: `${a.action} by ${a.admin}` })),
  ].sort((x, y) => x.at.localeCompare(y.at));

  return {
    id: user.id,
    name: user.name,
    teamId: user.teamId,
    teamName: user.team.name,
    ip: user.createdIp ?? null,
    joinedAt: user.createdAt.toISOString(),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    score,
    solves: solves.length,
    wrong: wrongs.length,
    status: (user.status as 'active' | 'banned') ?? 'active',
    bannedReason: user.bannedReason ?? null,
    adjustments: adjustments.map((a) => ({ id: a.id, points: a.points, reason: a.reason, admin: a.admin, at: a.createdAt.toISOString(), reversed: !!a.reversedAt })),
    timeline,
  };
}
