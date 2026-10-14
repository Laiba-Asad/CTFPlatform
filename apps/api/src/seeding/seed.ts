/** Seeds teams, the event window and challenges. Idempotent. Players are not
 * pre-created: they join themselves on first login. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { SEED_DIR } from '../scripts/cli';

const TeamsFile = z.array(
  z.object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'team id: lowercase letters, digits and hyphens'),
    name: z.string().min(1).max(40),
    avatar: z.string().startsWith('/'),
    tagline: z.string().max(120).default(''),
  }),
);

const EventFile = z.object({
  name: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  endsAt: z.string().datetime({ offset: true }).nullable(),
  devWindow: z.object({ startOffsetMinutes: z.number(), durationHours: z.number().positive() }),
});

const ChallengesFile = z.object({
  challenges: z.array(
    z.object({
      id: z.string().regex(/^(web|net)\d+$/),
      number: z.number().int().positive(),
      title: z.string().min(1),
      category: z.enum(['WEB', 'NETWORK']),
      points: z.number().int().positive(),
      difficulty: z.number().int().min(1).max(5),
      description: z.string().min(1),
      port: z.number().int().positive().optional(),
      file: z.string().optional(),
      downloadName: z.string().optional(),
      flagSalt: z.string().min(1),
      flagHash: z.string().min(1),
      released: z.boolean().default(false),
    }),
  ),
});

interface SeedOptions {
  seedDir?: string;
  updateEvent?: boolean;
  log?: (msg: string) => void;
}

type EventMode = 'scheduled' | 'live' | 'paused' | 'ended';

/** Initial shared-clock state for the event row, derived from EVENT_MODE/TIMER_MODE. */
function buildClock(
  mode: EventMode,
  timerMode: 'event' | 'scheduled',
  now: number,
  durationMs: number,
  window: { startsAt: Date; endsAt: Date },
): { status: string; startedAt: Date | null; endsAt: Date; pausedRemainingMs: number | null } {
  if (timerMode === 'scheduled') {
    // Legacy: follow the configured dates; derive the status from the window.
    const status = mode !== 'scheduled' ? mode : now < window.startsAt.getTime() ? 'waiting' : now >= window.endsAt.getTime() ? 'ended' : 'live';
    return { status, startedAt: status === 'waiting' ? null : window.startsAt, endsAt: window.endsAt, pausedRemainingMs: status === 'paused' ? Math.max(0, window.endsAt.getTime() - now) : null };
  }
  // Shared-clock (default): one countdown the organizer starts.
  switch (mode) {
    case 'live':
      return { status: 'live', startedAt: new Date(now), endsAt: new Date(now + durationMs), pausedRemainingMs: null };
    case 'paused':
      return { status: 'paused', startedAt: new Date(now), endsAt: new Date(now + durationMs), pausedRemainingMs: durationMs };
    case 'ended':
      return { status: 'ended', startedAt: new Date(now), endsAt: new Date(now), pausedRemainingMs: null };
    default: // scheduled → wait for the organizer to press Start
      return { status: 'waiting', startedAt: null, endsAt: new Date(now + durationMs), pausedRemainingMs: null };
  }
}

export async function seed(db: Db, config: AppConfig, options: SeedOptions = {}) {
  const dir = options.seedDir ?? SEED_DIR;
  const log = options.log ?? (() => {});
  const read = (file: string) => readFileSync(join(dir, file), 'utf8');

  const teams = TeamsFile.parse(JSON.parse(read('teams.json')));
  for (const t of teams) {
    await db.team.upsert({ where: { id: t.id }, create: t, update: { name: t.name, avatar: t.avatar, tagline: t.tagline } });
  }
  log(`Teams: ${teams.length} upserted`);

  const event = EventFile.parse(JSON.parse(read('event.json')));
  const startsAt = config.event.startsAt ?? (event.startsAt ? new Date(event.startsAt) : null);
  const endsAt = config.event.endsAt ?? (event.endsAt ? new Date(event.endsAt) : null);
  const mode = config.event.mode;
  let window: { startsAt: Date; endsAt: Date };
  if (startsAt && endsAt) {
    if (endsAt <= startsAt) throw new Error('Event end must be after its start');
    window = { startsAt, endsAt };
  } else if (mode === 'scheduled' && config.isProd) {
    throw new Error('Set real event dates (seed/event.json or EVENT_START/EVENT_END) before seeding a scheduled production event');
  } else {
    // No fixed dates: use a rolling window so the live-mode countdown is sensible.
    const start = Date.now() + event.devWindow.startOffsetMinutes * 60_000;
    window = { startsAt: new Date(start), endsAt: new Date(start + event.devWindow.durationHours * 3_600_000) };
  }
  // Shared-clock fields (TIMER_MODE=event). EVENT_MODE picks the initial status:
  // live starts the clock now, paused freezes a full clock, ended is over,
  // scheduled waits for the organizer to press Start.
  const durationMinutes = Math.round(config.event.durationMs / 60_000);
  const now = Date.now();
  const clock = buildClock(mode, config.event.timerMode, now, config.event.durationMs, window);
  const data = { name: event.name, mode, durationMinutes, ...window, ...clock };

  const existing = await db.event.findUnique({ where: { id: 'main' } });
  const describe = `${clock.status}, ${durationMinutes}m`;
  if (!existing) {
    await db.event.create({ data: { id: 'main', ...data } });
    log(`Event: created (${describe})`);
  } else if (options.updateEvent) {
    await db.event.update({ where: { id: 'main' }, data });
    log(`Event: updated (${describe})`);
  } else {
    log('Event: kept existing (pass --update-event to overwrite dates and mode)');
  }

  // Challenges (optional: only if flag:hash has been run). Flag material is
  // upserted; the released flag is preserved on existing rows unless auto-unlock.
  if (existsSync(join(dir, 'challenges.json'))) {
    const { challenges } = ChallengesFile.parse(JSON.parse(read('challenges.json')));
    for (const c of challenges) {
      const base = {
        number: c.number,
        title: c.title,
        description: c.description,
        category: c.category,
        difficulty: c.difficulty,
        points: c.points,
        flagHash: c.flagHash,
        flagSalt: c.flagSalt,
        port: c.port ?? null,
        visible: true,
      };
      const released = config.challenges.autoUnlockAll ? true : c.released;
      await db.challenge.upsert({
        where: { id: c.id },
        create: { id: c.id, released, ...base },
        // Keep an operator's current release state; only force it when auto-unlocking.
        update: config.challenges.autoUnlockAll ? { released: true, ...base } : base,
      });
      if (c.file) {
        const location = c.file;
        const name = c.downloadName ?? c.file;
        const existingAttachment = await db.attachment.findFirst({ where: { challengeId: c.id, kind: 'file' } });
        if (existingAttachment) {
          await db.attachment.update({ where: { id: existingAttachment.id }, data: { name, location } });
        } else {
          await db.attachment.create({ data: { challengeId: c.id, kind: 'file', name, location } });
        }
      }
    }
    log(`Challenges: ${challenges.length} upserted${config.challenges.autoUnlockAll ? ' (auto-unlocked)' : ''}`);
  } else {
    log('Challenges: skipped (run `npm run flag:hash` to generate seed/challenges.json)');
  }
}
