import { type AttentionItem, type FeedItem, type OverviewResponse, type ServiceHealthRow, compareMissions } from '@cydemic/shared';
import { Router } from 'express';
import { getEventState } from '../../services/event';
import { getEffectiveSettings } from '../../services/settings';
import { verifyFlag } from '../../services/flags';
import { aggregatePlayers } from '../../services/scoring';
import type { AdminDeps, AdminSupervisor } from './index';
import type { Db } from '../../lib/db';
import type { AppConfig } from '../../config';

export function overviewAdminRouter({ db, config, supervisor }: AdminDeps) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const event = await getEventState(db);
    const settings = await getEffectiveSettings(db, config);
    const twoMinAgo = new Date(Date.now() - 2 * 60_000);

    const [players, activePlayers, totalSolves, totalWrong, rawChallenges, aggs] = await Promise.all([
      db.user.count({ where: { role: 'player' } }),
      db.user.count({ where: { role: 'player', lastSeenAt: { gte: twoMinAgo } } }),
      db.solve.count(),
      db.submission.count({ where: { correct: false } }),
      db.challenge.findMany(),
      aggregatePlayers(db),
    ]);
    // Board order (points, then id); the display number is the position, never stored.
    const challenges = [...rawChallenges].sort(compareMissions).map((c, i) => ({ ...c, number: i + 1 }));
    const numbers = new Map(challenges.map((c) => [c.id, c.number]));

    // per-team
    const teamMap = new Map<string, { teamId: string; teamName: string; players: number; score: number }>();
    for (const a of aggs) {
      const t = teamMap.get(a.teamId) ?? { teamId: a.teamId, teamName: a.teamName, players: 0, score: 0 };
      t.players += 1;
      t.score += a.score;
      teamMap.set(a.teamId, t);
    }

    const solveGroups = await db.solve.groupBy({ by: ['challengeId'], _count: { _all: true } });
    const solvesByChallenge = new Map(solveGroups.map((g) => [g.challengeId, g._count._all]));
    const solvesPerMission = challenges.map((c) => ({ id: c.id, number: c.number, title: c.title, solves: solvesByChallenge.get(c.id) ?? 0 }));

    const services: ServiceHealthRow[] = challenges
      .filter((c) => c.port)
      .map((c) => ({ id: c.id, title: c.title, port: c.port, status: serviceStatus(supervisor, c) }));

    const [feed, attention] = await Promise.all([buildFeed(db, numbers), buildAttention(db, config, supervisor, challenges, numbers)]);

    const body: OverviewResponse = {
      event: {
        name: event.name,
        mode: event.mode,
        phase: event.phase,
        status: event.status,
        startedAt: event.startedAt?.toISOString() ?? null,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        durationMinutes: Math.round(event.durationMs / 60_000),
        remainingMs: event.remainingMs,
        serverNow: event.now,
        leaderboardFrozen: settings.leaderboardFrozen,
        freezeAt: settings.freezeAt?.toISOString() ?? null,
        freezeMinutesBeforeEnd: settings.freezeMinutesBeforeEnd,
        maintenance: settings.maintenance,
      },
      totals: { players, activePlayers, solves: totalSolves, wrong: totalWrong },
      perTeam: [...teamMap.values()].sort((a, b) => b.score - a.score),
      solvesPerMission,
      services,
      feed,
      attention,
    };
    res.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}

function serviceStatus(sup: AdminSupervisor | undefined, c: { id: string; port: number | null }): ServiceHealthRow['status'] {
  if (!c.port) return 'n/a';
  if (!sup?.supervising) return 'n/a';
  return sup.serviceStatus(c.id);
}

async function buildFeed(db: Db, numbers: Map<string, number>): Promise<FeedItem[]> {
  const [solves, wrongs, joins, admin] = await Promise.all([
    db.solve.findMany({ orderBy: { createdAt: 'desc' }, take: 15, include: { user: { include: { team: true } }, challenge: true } }),
    db.submission.findMany({ where: { correct: false }, orderBy: { createdAt: 'desc' }, take: 15, include: { user: { include: { team: true } }, challenge: true } }),
    db.user.findMany({ where: { role: 'player' }, orderBy: { createdAt: 'desc' }, take: 15, include: { team: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);
  const items: FeedItem[] = [
    ...solves.map((s) => ({ id: `s-${s.id}`, kind: 'solve' as const, at: s.createdAt.toISOString(), text: `${s.user.name} (${s.user.team.name}) solved #${numbers.get(s.challengeId) ?? 0} ${s.challenge.title}` })),
    ...wrongs.map((w) => ({ id: `w-${w.id}`, kind: 'wrong' as const, at: w.createdAt.toISOString(), text: `${w.user.name} (${w.user.team.name}) wrong on #${numbers.get(w.challengeId) ?? 0} ${w.challenge.title}` })),
    ...joins.map((u) => ({ id: `j-${u.id}`, kind: 'join' as const, at: u.createdAt.toISOString(), text: `${u.name} joined ${u.team.name}` })),
    ...admin.map((a) => ({ id: `a-${a.id}`, kind: 'admin' as const, at: a.createdAt.toISOString(), text: `${a.admin}: ${a.action}${a.target ? ` (${a.target})` : ''}` })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

async function buildAttention(
  db: Db,
  config: AppConfig,
  sup: AdminSupervisor | undefined,
  challenges: Array<{ id: string; number: number; title: string; port: number | null; flagHash: string; flagSalt: string }>,
  numbers: Map<string, number>,
): Promise<AttentionItem[]> {
  const out: AttentionItem[] = [];
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000);

  // Many wrong submissions from one player in the last 5 minutes.
  const recentWrong = await db.submission.groupBy({ by: ['userId'], where: { correct: false, createdAt: { gte: fiveMinAgo } }, _count: { _all: true } });
  for (const g of recentWrong.filter((x) => x._count._all >= 10)) {
    const u = await db.user.findUnique({ where: { id: g.userId } });
    if (u) out.push({ level: 'warn', text: `${u.name} made ${g._count._all} wrong submissions in 5 minutes` });
  }

  // A wrong submission whose text matches another mission's flag.
  const recentWrongRows = await db.submission.findMany({ where: { correct: false, text: { not: null }, createdAt: { gte: fiveMinAgo } }, include: { user: true, challenge: true }, take: 100 });
  for (const w of recentWrongRows) {
    const match = challenges.find((c) => c.id !== w.challengeId && w.text && verifyFlag(config.flagPepper, c.flagSalt, c.flagHash, w.text));
    if (match) out.push({ level: 'warn', text: `${w.user.name}'s wrong guess on #${numbers.get(w.challengeId) ?? 0} matches another mission's flag` });
  }

  // Many new players from one IP (possible abuse).
  const newByIp = await db.user.groupBy({ by: ['createdIp'], where: { role: 'player', createdIp: { not: null } }, _count: { _all: true } });
  for (const g of newByIp.filter((x) => x._count._all >= 10)) out.push({ level: 'info', text: `${g._count._all} players created from IP ${g.createdIp}` });

  // A challenge service that keeps crashing.
  if (sup?.supervising) for (const c of challenges) if (c.port && sup.restartsOf(c.id) >= 3) out.push({ level: 'warn', text: `Service ${c.id} (#${c.number}) has restarted ${sup.restartsOf(c.id)} times` });

  return out.slice(0, 20);
}
