import type { Db } from '../lib/db';

export interface PlayerAgg {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  avatar: string;
  solvePoints: number;
  adjustmentPoints: number;
  score: number;
  flags: number;
  wrong: number;
  lastSolve: number; // epoch ms, Infinity if none
  solvedChallengeIds: Set<string>;
}

/**
 * The single source of player scores, used by the player leaderboard, the hero
 * rank, and the admin side. Score = sum of solve points + non-reversed score
 * adjustments. Ranking tiebreaks live in {@link rankPlayers}.
 */
export async function aggregatePlayers(db: Db, asOf?: Date): Promise<PlayerAgg[]> {
  // When `asOf` is set (a frozen leaderboard), only count activity up to that time.
  const cutoff = asOf ? { createdAt: { lte: asOf } } : {};
  const [players, solves, wrongGroups, adjustments] = await Promise.all([
    db.user.findMany({ where: { role: 'player' }, include: { team: true } }),
    db.solve.findMany({ where: cutoff, orderBy: { createdAt: 'asc' }, select: { userId: true, challengeId: true, points: true, createdAt: true } }),
    db.submission.groupBy({ by: ['userId'], where: { correct: false, ...cutoff }, _count: { _all: true } }),
    db.scoreAdjustment.findMany({ where: { reversedAt: null, ...cutoff }, select: { userId: true, points: true } }),
  ]);

  const wrongByUser = new Map(wrongGroups.map((g) => [g.userId, g._count._all]));
  const adjByUser = new Map<string, number>();
  for (const a of adjustments) adjByUser.set(a.userId, (adjByUser.get(a.userId) ?? 0) + a.points);

  const agg = new Map<string, PlayerAgg>();
  for (const p of players) {
    agg.set(p.id, {
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      teamName: p.team.name,
      avatar: p.team.avatar,
      solvePoints: 0,
      adjustmentPoints: adjByUser.get(p.id) ?? 0,
      score: adjByUser.get(p.id) ?? 0,
      flags: 0,
      wrong: wrongByUser.get(p.id) ?? 0,
      lastSolve: Infinity,
      solvedChallengeIds: new Set(),
    });
  }
  for (const s of solves) {
    const a = agg.get(s.userId);
    if (!a) continue;
    a.solvePoints += s.points;
    a.score += s.points;
    a.flags += 1;
    a.lastSolve = s.createdAt.getTime();
    a.solvedChallengeIds.add(s.challengeId);
  }
  return [...agg.values()];
}

/** Score desc, then fewer wrong submissions, then earlier last solve. */
export function rankPlayers(aggs: PlayerAgg[]): PlayerAgg[] {
  return [...aggs].sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (x.wrong !== y.wrong) return x.wrong - y.wrong;
    return x.lastSolve - y.lastSolve;
  });
}
