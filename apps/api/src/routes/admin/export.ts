import { Router } from 'express';
import { aggregatePlayers, rankPlayers } from '../../services/scoring';
import { getLeaderboard } from '../../services/leaderboard';
import { auditFromReq } from '../../services/audit';
import { toCsv } from './submissions';
import type { AdminDeps } from './index';

/** Results, solves and submissions as CSV/JSON, plus a certificates-ready CSV. */
export function exportAdminRouter({ db, config }: AdminDeps) {
  const router = Router();

  router.get('/results.json', async (req, res) => {
    const board = await getLeaderboard(db, config, {});
    await auditFromReq(db, req, 'export.results.json');
    res.json({ players: board.players, teams: board.teams });
  });

  router.get('/results.csv', async (req, res) => {
    const ranked = rankPlayers(await aggregatePlayers(db));
    const rows = [
      ['rank', 'name', 'team', 'score', 'solves', 'wrong'],
      ...ranked.map((a, i) => [i + 1, a.name, a.teamName, a.score, a.flags, a.wrong]),
    ];
    await auditFromReq(db, req, 'export.results.csv');
    csv(res, 'results.csv', rows);
  });

  // Ready for batch certificate generation: name, team, rank, score, solved count.
  router.get('/certificates.csv', async (req, res) => {
    const ranked = rankPlayers(await aggregatePlayers(db));
    const rows = [
      ['name', 'team', 'rank', 'score', 'solved'],
      ...ranked.map((a, i) => [a.name, a.teamName, i + 1, a.score, a.flags]),
    ];
    await auditFromReq(db, req, 'export.certificates');
    csv(res, 'certificates.csv', rows);
  });

  router.get('/solves.csv', async (req, res) => {
    const solves = await db.solve.findMany({ orderBy: { createdAt: 'asc' }, include: { user: { include: { team: true } }, challenge: true } });
    const rows = [
      ['time', 'player', 'team', 'mission', 'points'],
      ...solves.map((s) => [s.createdAt.toISOString(), s.user.name, s.user.team.name, `#${s.challenge.number} ${s.challenge.title}`, s.points]),
    ];
    await auditFromReq(db, req, 'export.solves');
    csv(res, 'solves.csv', rows);
  });

  return router;
}

function csv(res: import('express').Response, filename: string, rows: (string | number)[][]) {
  res.set('Content-Type', 'text/csv').set('Content-Disposition', `attachment; filename="${filename}"`).send(toCsv(rows));
}
