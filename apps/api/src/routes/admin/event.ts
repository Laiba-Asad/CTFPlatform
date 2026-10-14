import type { AdminEventState } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { requireAdminRole } from '../../middleware/admin-auth';
import { auditFromReq } from '../../services/audit';
import { getEventState } from '../../services/event';
import { getEffectiveSettings, getSettingsRow } from '../../services/settings';
import type { AdminDeps } from './index';

const RescheduleBody = z.object({
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  mode: z.enum(['scheduled', 'live', 'paused', 'ended']).optional(),
});
const ExtendBody = z.object({ minutes: z.number().int().refine((m) => [5, 15, 30, -5, -15, -30].includes(m), 'minutes must be ±5/15/30') });
const FreezeBody = z.object({ frozen: z.boolean().optional(), minutesBeforeEnd: z.number().int().positive().nullable().optional() });
const MaintenanceBody = z.object({ maintenance: z.boolean() });

export function eventAdminRouter({ db, config }: AdminDeps) {
  const router = Router();

  async function state(): Promise<AdminEventState> {
    const [s, settings] = await Promise.all([getEventState(db), getEffectiveSettings(db, config)]);
    return {
      name: s.name,
      mode: s.mode,
      phase: s.phase,
      status: s.status,
      startedAt: s.startedAt?.toISOString() ?? null,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      durationMinutes: Math.round(s.durationMs / 60_000),
      remainingMs: s.remainingMs,
      serverNow: s.now,
      leaderboardFrozen: settings.leaderboardFrozen,
      freezeAt: settings.freezeAt?.toISOString() ?? null,
      freezeMinutesBeforeEnd: settings.freezeMinutesBeforeEnd,
      maintenance: settings.maintenance,
    };
  }

  /** Ensure the singleton event row exists (so updates never 404). */
  async function ensureEvent() {
    const existing = await db.event.findUnique({ where: { id: 'main' } });
    if (existing) return existing;
    const now = Date.now();
    return db.event.create({
      data: { id: 'main', name: 'Cydemic CTF', mode: 'scheduled', status: 'waiting', startsAt: new Date(now), endsAt: new Date(now + config.event.durationMs), durationMinutes: Math.round(config.event.durationMs / 60_000) },
    });
  }

  router.get('/', async (_req, res) => res.set('Cache-Control', 'no-store').json(await state()));

  // --- Shared-clock controls ---------------------------------------------------

  // Start the one shared clock now. Idempotent and race-safe: a second click or
  // a second admin starting at the same moment has no extra effect.
  router.post('/start', requireAdminRole, async (req, res) => {
    const row = await ensureEvent();
    const now = Date.now();
    const durationMs = row.durationMinutes * 60_000;
    // Only transition from `waiting`; updateMany with the guard makes this atomic.
    const { count } = await db.event.updateMany({
      where: { id: 'main', status: 'waiting' },
      data: { status: 'live', startedAt: new Date(now), endsAt: new Date(now + durationMs), pausedRemainingMs: null },
    });
    if (count > 0) await auditFromReq(db, req, 'event.start', { after: { durationMinutes: row.durationMinutes } });
    res.json(await state());
  });

  router.post('/pause', requireAdminRole, async (req, res) => {
    const s = await getEventState(db);
    if (s.status !== 'live') return res.json(await state()); // idempotent
    await db.event.update({ where: { id: 'main' }, data: { status: 'paused', pausedRemainingMs: s.remainingMs } });
    await auditFromReq(db, req, 'event.pause', { after: { remainingMs: s.remainingMs } });
    res.json(await state());
  });

  router.post('/resume', requireAdminRole, async (req, res) => {
    const s = await getEventState(db);
    if (s.status !== 'paused') return res.json(await state()); // idempotent
    const remaining = s.remainingMs;
    await db.event.update({ where: { id: 'main' }, data: { status: 'live', startedAt: s.startedAt ?? new Date(), endsAt: new Date(Date.now() + remaining), pausedRemainingMs: null } });
    await auditFromReq(db, req, 'event.resume', { after: { remainingMs: remaining } });
    res.json(await state());
  });

  router.post('/end', requireAdminRole, async (req, res) => {
    await ensureEvent();
    await db.event.update({ where: { id: 'main' }, data: { status: 'ended', pausedRemainingMs: null } });
    await auditFromReq(db, req, 'event.end');
    res.json(await state());
  });

  // Extend (or trim) the clock by a fixed amount. Works live or paused.
  router.post('/extend', requireAdminRole, async (req, res) => {
    const { minutes } = ExtendBody.parse(req.body);
    const s = await getEventState(db);
    const deltaMs = minutes * 60_000;
    if (s.status === 'paused') {
      const next = Math.max(0, (s.remainingMs ?? 0) + deltaMs);
      await db.event.update({ where: { id: 'main' }, data: { pausedRemainingMs: next } });
    } else {
      const base = s.status === 'live' ? s.endsAt.getTime() : Date.now();
      const endsAt = new Date(base + deltaMs);
      if (endsAt.getTime() <= (s.startedAt?.getTime() ?? Date.now())) throw new HttpError(400, 'BAD_RANGE', 'That would put the end before the start.');
      await db.event.update({ where: { id: 'main' }, data: { endsAt } });
    }
    await auditFromReq(db, req, 'event.extend', { after: { minutes } });
    res.json(await state());
  });

  // Legacy reschedule (TIMER_MODE=scheduled): set mode/dates directly.
  router.put('/', requireAdminRole, async (req, res) => {
    const body = RescheduleBody.parse(req.body);
    if (!body.mode && !body.startsAt && !body.endsAt) throw new HttpError(400, 'NO_CHANGES', 'Nothing to change.');
    if (body.mode === 'live' && config.isProd) throw new HttpError(400, 'LIVE_FORBIDDEN', 'Force-live is not allowed in production.');
    const before = await getEventState(db);
    const startsAt = body.startsAt ? new Date(body.startsAt) : before.startsAt;
    const endsAt = body.endsAt ? new Date(body.endsAt) : before.endsAt;
    if (endsAt <= startsAt) throw new HttpError(400, 'BAD_RANGE', 'The end must be after the start.');
    const mode = body.mode ?? before.mode;
    // Keep `status` consistent with the chosen mode so the shared clock agrees.
    const status = mode === 'scheduled' ? before.status : mode;
    await db.event.upsert({
      where: { id: 'main' },
      create: { id: 'main', name: before.name, mode, status, startsAt, endsAt, durationMinutes: Math.round(config.event.durationMs / 60_000) },
      update: { mode, status, startsAt, endsAt },
    });
    await auditFromReq(db, req, 'event.update', { before: { mode: before.mode, startsAt: before.startsAt, endsAt: before.endsAt }, after: { mode, startsAt, endsAt } });
    res.json(await state());
  });

  router.post('/freeze', requireAdminRole, async (req, res) => {
    const body = FreezeBody.parse(req.body);
    const row = await getSettingsRow(db);
    const data: { leaderboardFrozen?: boolean; freezeAt?: Date | null; freezeMinutesBeforeEnd?: number | null } = {};
    if (body.frozen !== undefined) {
      data.leaderboardFrozen = body.frozen;
      data.freezeAt = body.frozen ? new Date() : null;
    }
    if (body.minutesBeforeEnd !== undefined) data.freezeMinutesBeforeEnd = body.minutesBeforeEnd;
    await db.settings.update({ where: { id: 'main' }, data });
    await auditFromReq(db, req, 'event.freeze', { before: { frozen: row.leaderboardFrozen, minutesBeforeEnd: row.freezeMinutesBeforeEnd }, after: data });
    res.json(await state());
  });

  router.post('/maintenance', requireAdminRole, async (req, res) => {
    const { maintenance } = MaintenanceBody.parse(req.body);
    const row = await getSettingsRow(db);
    await db.settings.update({ where: { id: 'main' }, data: { maintenance } });
    await auditFromReq(db, req, 'event.maintenance', { before: { maintenance: row.maintenance }, after: { maintenance } });
    res.json(await state());
  });

  return router;
}
