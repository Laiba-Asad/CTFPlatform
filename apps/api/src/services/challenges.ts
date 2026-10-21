import type { ChallengeCard, EventPhase, MissionState } from '@cydemic/shared';
import { compareMissions, hasEventStarted, isEventLive, missionNumbers } from '@cydemic/shared';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { getEventState } from './event';
import { verifyFlag } from './flags';

/** Minimal view of the supervisor the challenge list needs (so tests can stub it). */
export interface ServiceHealth {
  supervising: boolean;
  serviceStatus(cid: string): 'up' | 'starting' | 'down';
}

/**
 * Decide the mission state for one challenge, with an explicit reason so the UI
 * never shows an event reason and an admin reason as the same "LOCKED".
 */
function missionState(
  challenge: { id: string; released: boolean; port: number | null },
  solved: boolean,
  phase: EventPhase,
  health: ServiceHealth | undefined,
): MissionState {
  if (solved) return 'solved';
  if (phase === 'upcoming') return 'opens_at_start';
  if (phase === 'paused') return 'paused';
  if (phase === 'ended') return 'event_ended';
  // phase === 'live'
  if (!challenge.released) return 'locked';
  // Released and live. For challenges with a service, reflect its health when the
  // supervisor is actually managing services; otherwise assume available.
  if (challenge.port && health?.supervising) {
    const status = health.serviceStatus(challenge.id);
    if (status === 'starting') return 'starting';
    if (status === 'down') return 'unavailable';
  }
  return 'available';
}

/**
 * Display number ("MISSION 01", "#1") of every challenge, from board order
 * (points, then id). Derived on every read; the challenge id is the identity.
 */
export async function missionNumberMap(db: Db): Promise<Map<string, number>> {
  return missionNumbers(await db.challenge.findMany({ select: { id: true, points: true } }));
}

/** Player-facing challenge list. Never includes flag material or hidden content. */
export async function listChallenges(
  db: Db,
  userId: string,
  health?: ServiceHealth,
): Promise<{ cards: ChallengeCard[]; live: boolean }> {
  const { window, now, phase } = await getEventState(db);
  const started = hasEventStarted(window, now);
  const live = isEventLive(window, now);

  const [challenges, mySolves] = await Promise.all([
    db.challenge.findMany({
      where: { visible: true },
      include: { attachments: { where: { kind: 'file' }, take: 1 }, _count: { select: { solves: true } } },
    }),
    db.solve.findMany({ where: { userId }, select: { challengeId: true } }),
  ]);
  const solvedSet = new Set(mySolves.map((s) => s.challengeId));

  // Board order: points ascending, then id. The card number is the position in it.
  const cards = [...challenges].sort(compareMissions).map((c, index): ChallengeCard => {
    const solved = solvedSet.has(c.id);
    const state = missionState({ id: c.id, released: c.released, port: c.port }, solved, phase, health);
    // Content is revealed once the event has started AND the challenge is released.
    const reveal = started && c.released;
    return {
      id: c.id,
      number: index + 1,
      title: c.title,
      category: c.category,
      points: c.points,
      state,
      solves: c._count.solves,
      // Every challenge runs a browser-openable service, so its port is the
      // target link. (The board is browser-only; nothing is found by scanning.)
      port: c.port ?? null,
      hasFile: c.attachments.length > 0,
      description: reveal ? c.description : null,
    };
  });
  return { cards, live };
}

export type SubmitResult =
  | { outcome: 'correct'; pointsAwarded: number }
  | { outcome: 'already_solved' }
  | { outcome: 'incorrect' };

/**
 * Checks a submitted flag against the stored HMAC and records the attempt.
 * The caller enforces rate limiting and cooldown; this enforces the time
 * window and the release state on the server regardless of the UI.
 */
export async function submitFlag(
  db: Db,
  config: AppConfig,
  params: { userId: string; challengeId: string; flag: string; ip: string },
): Promise<SubmitResult> {
  const { window, now, phase } = await getEventState(db);
  if (!isEventLive(window, now)) {
    throw new SubmissionClosed(submissionClosedMessage(phase));
  }
  const challenge = await db.challenge.findUnique({ where: { id: params.challengeId } });
  if (!challenge || !challenge.visible || !challenge.released) {
    throw new SubmissionClosed('This challenge is not open.');
  }

  const correct = verifyFlag(config.flagPepper, challenge.flagSalt, challenge.flagHash, params.flag);
  // Correct submissions never store the text (that would persist a real flag).
  // Wrong guesses store the text for admin review (capped length).
  await db.submission.create({
    data: {
      userId: params.userId,
      challengeId: challenge.id,
      correct,
      ip: params.ip,
      text: correct ? null : params.flag.slice(0, 256),
    },
  });

  if (!correct) return { outcome: 'incorrect' };

  const existing = await db.solve.findUnique({
    where: { userId_challengeId: { userId: params.userId, challengeId: challenge.id } },
  });
  if (existing) return { outcome: 'already_solved' };

  try {
    await db.solve.create({
      data: { userId: params.userId, challengeId: challenge.id, points: challenge.points },
    });
  } catch {
    // Unique constraint: a concurrent submission already recorded the solve.
    return { outcome: 'already_solved' };
  }
  return { outcome: 'correct', pointsAwarded: challenge.points };
}

function submissionClosedMessage(phase: 'upcoming' | 'live' | 'paused' | 'ended'): string {
  if (phase === 'upcoming') return 'The event has not started yet.';
  if (phase === 'paused') return 'The event is paused. Submissions are closed.';
  if (phase === 'ended') return 'The event has ended. Submissions are closed.';
  return 'Submissions are closed.';
}

/** Count a user's wrong attempts on a challenge in the recent window (for the UI counter). */
export async function recentWrongAttempts(db: Db, userId: string, challengeId: string, sinceMs: number): Promise<number> {
  return db.submission.count({
    where: { userId, challengeId, correct: false, createdAt: { gte: new Date(Date.now() - sinceMs) } },
  });
}

export class SubmissionClosed extends Error {}
