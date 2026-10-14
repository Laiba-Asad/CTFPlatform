import type { PlayerStats, SolvedMission } from '@cydemic/shared';
import type { Db } from '../lib/db';
import { aggregatePlayers, rankPlayers } from './scoring';

/**
 * Player stats and rank, derived from the shared aggregator (solves +
 * adjustments) so the hero card rank always matches the leaderboard. A player
 * with no score has no rank yet.
 */
export async function getPlayerStats(db: Db, userId: string): Promise<PlayerStats> {
  const [aggs, totalChallenges] = await Promise.all([
    aggregatePlayers(db),
    db.challenge.count({ where: { visible: true } }),
  ]);
  const ranked = rankPlayers(aggs);
  const idx = ranked.findIndex((a) => a.id === userId);
  const mine = idx >= 0 ? ranked[idx] : undefined;
  const score = mine?.score ?? 0;
  const flagsCaptured = mine?.flags ?? 0;
  const rank = mine && score > 0 ? idx + 1 : null;
  return { rank, score, flagsCaptured, totalChallenges };
}

export async function getSolvedMissions(db: Db, userId: string): Promise<SolvedMission[]> {
  const solves = await db.solve.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { challenge: { select: { id: true, number: true, title: true, category: true } } },
  });
  return solves.map((s) => ({
    challengeId: s.challenge.id,
    number: s.challenge.number,
    title: s.challenge.title,
    category: s.challenge.category,
    points: s.points,
    solvedAt: s.createdAt.toISOString(),
  }));
}
