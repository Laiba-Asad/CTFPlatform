import type { LeaderboardResponse, LeaderboardSeries } from '@cydemic/shared';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { aggregatePlayers, rankPlayers } from './scoring';

/**
 * Player/team leaderboard with a score-over-time series. Ranking and scores
 * come from the shared aggregator (solves + adjustments). Team score follows
 * TEAM_SCORING: `sum` adds members' scores; `unique` counts each challenge once.
 */
export async function getLeaderboard(
  db: Db,
  config: AppConfig,
  opts: { viewerId?: string; asOf?: Date; frozen?: boolean } = {},
): Promise<LeaderboardResponse> {
  const { viewerId, asOf, frozen = false } = opts;
  const [aggs, challenges] = await Promise.all([
    aggregatePlayers(db, asOf),
    db.challenge.findMany({ select: { id: true, points: true } }),
  ]);
  const challengePoints = new Map(challenges.map((c) => [c.id, c.points]));
  const ranked = rankPlayers(aggs);

  const players = ranked.map((a, i) => ({
    rank: i + 1,
    name: a.name,
    teamId: a.teamId,
    teamName: a.teamName,
    avatar: a.avatar,
    score: a.score,
    flags: a.flags,
    isYou: viewerId === a.id || undefined,
  }));

  // Teams.
  const teamMap = new Map<string, { teamId: string; teamName: string; avatar: string; score: number; flags: number; members: number; lastSolve: number; wrong: number; uniqueSolved: Set<string> }>();
  for (const a of aggs) {
    let t = teamMap.get(a.teamId);
    if (!t) {
      t = { teamId: a.teamId, teamName: a.teamName, avatar: a.avatar, score: 0, flags: 0, members: 0, lastSolve: Infinity, wrong: 0, uniqueSolved: new Set() };
      teamMap.set(a.teamId, t);
    }
    t.members += 1;
    t.wrong += a.wrong;
    t.flags += a.flags;
    if (a.lastSolve < t.lastSolve) t.lastSolve = a.lastSolve;
    if (config.scoring.team === 'unique') for (const cid of a.solvedChallengeIds) t.uniqueSolved.add(cid);
    else t.score += a.score;
  }
  if (config.scoring.team === 'unique') {
    for (const t of teamMap.values()) t.score = [...t.uniqueSolved].reduce((s, cid) => s + (challengePoints.get(cid) ?? 0), 0);
  }
  const viewerTeamId = viewerId ? aggs.find((a) => a.id === viewerId)?.teamId : undefined;
  const teams = [...teamMap.values()]
    .sort((x, y) => y.score - x.score || x.wrong - y.wrong || x.lastSolve - y.lastSolve)
    .map((t, i) => ({ rank: i + 1, teamId: t.teamId, teamName: t.teamName, avatar: t.avatar, score: t.score, flags: t.flags, members: t.members, isYours: viewerTeamId === t.teamId || undefined }));

  // Score-over-time for the top players (plus the viewer). Uses solve points only.
  const solves = await db.solve.findMany({ where: asOf ? { createdAt: { lte: asOf } } : {}, orderBy: { createdAt: 'asc' }, select: { userId: true, points: true, createdAt: true } });
  const topIds = new Set(ranked.slice(0, 6).map((a) => a.id));
  if (viewerId && aggs.some((a) => a.id === viewerId)) topIds.add(viewerId);
  const running = new Map<string, number>();
  const pts = new Map<string, Array<{ t: string; score: number }>>();
  for (const idv of topIds) pts.set(idv, []);
  for (const s of solves) {
    if (!topIds.has(s.userId)) continue;
    const next = (running.get(s.userId) ?? 0) + s.points;
    running.set(s.userId, next);
    pts.get(s.userId)!.push({ t: s.createdAt.toISOString(), score: next });
  }
  const byId = new Map(aggs.map((a) => [a.id, a]));
  const series: LeaderboardSeries[] = [...topIds].map((idv) => ({
    name: byId.get(idv)!.name,
    isYou: viewerId === idv || undefined,
    points: pts.get(idv)!,
  }));

  return { players, teams, series, frozen };
}
