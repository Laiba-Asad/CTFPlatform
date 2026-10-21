import { RETIRED_CHALLENGE_IDS } from '../challenges/retired';
import type { Db } from '../lib/db';

export interface RetireCounts {
  challenges: number;
  solves: number;
  submissions: number;
  hintUnlocks: number;
  hints: number;
  attachments: number;
  /** Other challenges whose unlock-after pointed at a retired one (link cleared). */
  unlockLinksCleared: number;
  /** Score adjustments belong to players, not challenges, so none reference a retired id. */
  scoreAdjustments: number;
}

/**
 * Delete retired challenges and every row that references them, in one
 * transaction, so no dangling reference is left. Scores are derived from
 * solves + adjustments (services/scoring.ts), so they recompute on the next read.
 * Idempotent: a second run removes nothing.
 */
export async function retireChallenges(db: Db, ids: readonly string[] = RETIRED_CHALLENGE_IDS): Promise<RetireCounts> {
  const challengeId = { in: [...ids] };
  const hintIds = (await db.hint.findMany({ where: { challengeId }, select: { id: true } })).map((h) => h.id);
  const [unlockLinks, hintUnlocks, solves, submissions, hints, attachments, challenges] = await db.$transaction([
    db.challenge.updateMany({ where: { unlockAfterId: challengeId, id: { notIn: [...ids] } }, data: { unlockAfterId: null } }),
    db.hintUnlock.deleteMany({ where: { hintId: { in: hintIds } } }),
    db.solve.deleteMany({ where: { challengeId } }),
    db.submission.deleteMany({ where: { challengeId } }),
    db.hint.deleteMany({ where: { challengeId } }),
    db.attachment.deleteMany({ where: { challengeId } }),
    db.challenge.deleteMany({ where: { id: challengeId } }),
  ]);
  return {
    challenges: challenges.count,
    solves: solves.count,
    submissions: submissions.count,
    hintUnlocks: hintUnlocks.count,
    hints: hints.count,
    attachments: attachments.count,
    unlockLinksCleared: unlockLinks.count,
    scoreAdjustments: 0,
  };
}
