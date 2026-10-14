import { statusToPhase, type EventMode, type EventPhase, type EventStatus, type EventWindow } from '@cydemic/shared';
import type { Db } from '../lib/db';

export interface EventState {
  name: string;
  /** Shared-clock status (the single source of truth). */
  status: EventStatus;
  /** Back-compat display phase: waiting→upcoming, else 1:1 with status. */
  phase: EventPhase;
  /** Back-compat mode: waiting→scheduled, else 1:1 with status. */
  mode: EventMode;
  /** When the event was started (null while waiting). */
  startedAt: Date | null;
  startsAt: Date;
  endsAt: Date;
  /** Configured length of the event once started. */
  durationMs: number;
  /** Time left on the shared clock right now (frozen while paused). */
  remainingMs: number;
  /** Window for the shared timing helpers. */
  window: EventWindow;
  now: number;
}

const STATUSES: EventStatus[] = ['waiting', 'live', 'paused', 'ended'];
function asStatus(value: string): EventStatus {
  return (STATUSES as string[]).includes(value) ? (value as EventStatus) : 'waiting';
}

/**
 * The single source of truth for event state, read from the database row.
 * The shared clock is driven by `status`: everyone sees the same countdown to a
 * single `endsAt`, computed against server time. A live event whose clock has
 * run out reads as `ended` (so the server rejects late submissions on its own).
 */
export async function getEventState(db: Db): Promise<EventState> {
  const now = Date.now();
  const event = await db.event.findUnique({ where: { id: 'main' } });

  if (!event) {
    // No event configured yet: waiting, with the default one-hour clock.
    const durationMs = 60 * 60_000;
    const window: EventWindow = { startsAt: now + durationMs, endsAt: now + 2 * durationMs, mode: 'scheduled' };
    return {
      name: 'Cydemic CTF',
      status: 'waiting',
      phase: 'upcoming',
      mode: 'scheduled',
      startedAt: null,
      startsAt: new Date(now),
      endsAt: new Date(now + durationMs),
      durationMs,
      remainingMs: durationMs,
      window,
      now,
    };
  }

  const durationMs = event.durationMinutes * 60_000;
  let status = asStatus(event.status);
  // A live clock that has run out is effectively ended (server-authoritative).
  if (status === 'live' && now >= event.endsAt.getTime()) status = 'ended';

  const startedAt = event.startedAt;
  const endsAt = event.endsAt;

  const remainingMs =
    status === 'waiting'
      ? durationMs
      : status === 'paused'
        ? (event.pausedRemainingMs ?? Math.max(0, endsAt.getTime() - now))
        : status === 'ended'
          ? 0
          : Math.max(0, endsAt.getTime() - now); // live

  // Window for the shared helpers: waiting looks like a scheduled, not-yet-open
  // event; live/paused/ended map straight through.
  const window: EventWindow =
    status === 'waiting'
      ? { mode: 'scheduled', startsAt: now + durationMs, endsAt: now + 2 * durationMs }
      : { mode: status, startsAt: startedAt?.getTime() ?? now, endsAt: endsAt.getTime() };

  return {
    name: event.name,
    status,
    phase: statusToPhase(status),
    mode: status === 'waiting' ? 'scheduled' : status,
    startedAt,
    startsAt: startedAt ?? new Date(now),
    endsAt,
    durationMs,
    remainingMs,
    window,
    now,
  };
}
