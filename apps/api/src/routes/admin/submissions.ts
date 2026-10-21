import { type AdminSubmissionRow, missionNumbers } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { verifyFlag } from '../../services/flags';
import type { AdminDeps } from './index';
import type { Db } from '../../lib/db';
import type { AppConfig } from '../../config';

const Query = z.object({
  playerId: z.string().optional(),
  teamId: z.string().optional(),
  challengeId: z.string().optional(),
  result: z.enum(['correct', 'wrong']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

async function query(db: Db, config: AppConfig, q: z.infer<typeof Query>) {
  const where: Record<string, unknown> = {};
  if (q.playerId) where.userId = q.playerId;
  if (q.challengeId) where.challengeId = q.challengeId;
  if (q.result) where.correct = q.result === 'correct';
  if (q.teamId) where.user = { teamId: q.teamId };
  if (q.from || q.to) where.createdAt = { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) };

  const challenges = await db.challenge.findMany({ select: { id: true, points: true, flagHash: true, flagSalt: true } });
  const numbers = missionNumbers(challenges);
  const matchFor = (text: string | null): string | null => {
    if (!text) return null;
    for (const c of challenges) if (verifyFlag(config.flagPepper, c.flagSalt, c.flagHash, text)) return c.id;
    return null;
  };

  const [total, subs] = await Promise.all([
    db.submission.count({ where }),
    db.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { include: { team: true } }, challenge: true },
    }),
  ]);

  const items: AdminSubmissionRow[] = subs.map((s) => ({
    id: s.id,
    at: s.createdAt.toISOString(),
    playerName: s.user.name,
    teamName: s.user.team.name,
    missionNumber: numbers.get(s.challengeId) ?? 0,
    missionTitle: s.challenge.title,
    correct: s.correct,
    ip: s.ip,
    text: s.correct ? null : s.text,
    matchesMissionId: s.correct ? null : matchFor(s.text),
  }));
  return { items, total };
}

export function submissionsAdminRouter({ db, config }: AdminDeps) {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = Query.parse(req.query);
    const { items, total } = await query(db, config, q);
    res.set('Cache-Control', 'no-store').json({ items, total, page: q.page, pageSize: q.pageSize });
  });

  router.get('/export.csv', async (req, res) => {
    const q = Query.parse({ ...req.query, pageSize: 500, page: 1 });
    // Export every row (ignore pagination) for the CSV.
    const all = await query(db, config, { ...q, page: 1, pageSize: 100000 });
    const rows = [
      ['time', 'player', 'team', 'mission', 'result', 'ip', 'wrong_text', 'matches_mission'],
      ...all.items.map((s) => [s.at, s.playerName, s.teamName, `#${s.missionNumber} ${s.missionTitle}`, s.correct ? 'correct' : 'wrong', s.ip, s.text ?? '', s.matchesMissionId ?? '']),
    ];
    res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="submissions.csv"').send(toCsv(rows));
  });

  return router;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
