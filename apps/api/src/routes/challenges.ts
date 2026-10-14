import type { ChallengesResponse, SubmitResponse } from '@cydemic/shared';
import { Router } from 'express';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import type { AppConfig } from '../config';
import { API_ROOT } from '../db-url';
import { FailureCooldown, toRetrySeconds } from '../lib/cooldown';
import type { Db } from '../lib/db';
import { HttpError } from '../lib/http-error';
import { requireAuth } from '../middleware/auth';
import { cooldownError } from './auth';
import { listChallenges, recentWrongAttempts, submitFlag, SubmissionClosed, type ServiceHealth } from '../services/challenges';
import { getEventState } from '../services/event';

const CAPTURES_DIR = resolve(API_ROOT, '../..', 'challenge-services', 'generated', 'captures');
const SubmitBody = z.object({ flag: z.string().min(1).max(256) });

/** Player challenge endpoints. Every route requires a session. */
export function challengesRouter(db: Db, config: AppConfig, health?: ServiceHealth) {
  const router = Router();
  router.use(requireAuth);

  // 5 submissions per user per challenge per minute.
  const windowHits = new Map<string, number[]>();
  // Consecutive wrong answers per user+challenge -> short cooldown (<= 30s).
  const cooldown = new FailureCooldown({
    maxFailures: config.rateLimits.submitLockoutFailures,
    cooldownMs: config.rateLimits.cooldownMs,
  });

  router.get('/', async (req, res) => {
    const { cards, live } = await listChallenges(db, req.user!.id, health);
    const body: ChallengesResponse = { challenges: cards, acceptingSubmissions: live };
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.post('/:id/submit', async (req, res) => {
    const userId = req.user!.id;
    const challengeId = req.params.id;
    const key = `${userId}:${challengeId}`;

    const blocked = cooldown.check(key);
    if (blocked.locked) throw cooldownError(blocked, 'Too many wrong attempts.');

    const now = Date.now();
    const hits = (windowHits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (hits.length >= config.rateLimits.submitPerMinute) {
      throw new HttpError(429, 'RATE_LIMITED', 'Slow down: too many submissions this minute.', {
        retryAfterSeconds: toRetrySeconds(60_000 - (now - hits[0]!)),
      });
    }
    hits.push(now);
    windowHits.set(key, hits);

    const { flag } = SubmitBody.parse(req.body);
    let result;
    try {
      result = await submitFlag(db, config, { userId, challengeId, flag, ip: req.ip ?? 'unknown' });
    } catch (err) {
      if (err instanceof SubmissionClosed) throw new HttpError(403, 'SUBMISSION_CLOSED', err.message);
      throw err;
    }

    if (result.outcome === 'correct') {
      cooldown.reset(key);
      req.log.info({ event: 'solve', userId, challengeId }, 'challenge solved');
      const body: SubmitResponse = { outcome: 'correct', pointsAwarded: result.pointsAwarded };
      return res.json(body);
    }
    if (result.outcome === 'already_solved') {
      cooldown.reset(key);
      const body: SubmitResponse = { outcome: 'already_solved' };
      return res.json(body);
    }

    const after = cooldown.recordFailure(key);
    const attempts = await recentWrongAttempts(db, userId, challengeId, 60_000);
    if (after.locked) throw cooldownError(after, 'Too many wrong attempts.');
    const body: SubmitResponse = { outcome: 'incorrect', attempts };
    res.status(200).json(body);
  });

  // Capture files (net challenges): authorized, and only while live + released.
  router.get('/:id/attachment', async (req, res) => {
    const { window, challenge } = await loadForDownload(db, req.params.id);
    if (!window.live) throw new HttpError(403, 'NOT_AVAILABLE', 'Attachments are available while the event is live.');
    if (!challenge || !challenge.released || !challenge.visible) throw new HttpError(404, 'NOT_FOUND', 'Not found');
    const attachment = challenge.attachments[0];
    if (!attachment) throw new HttpError(404, 'NOT_FOUND', 'No attachment');

    const filePath = join(CAPTURES_DIR, basename(attachment.location));
    if (!existsSync(filePath)) {
      req.log.error({ challengeId: challenge.id }, 'capture file missing on disk');
      throw new HttpError(404, 'NOT_FOUND', 'Attachment not generated. Run the capture generator.');
    }
    res.set('Cache-Control', 'no-store');
    res.download(filePath, attachment.name);
  });

  return router;
}

async function loadForDownload(db: Db, id: string) {
  const [state, challenge] = await Promise.all([
    getEventState(db),
    db.challenge.findUnique({ where: { id }, include: { attachments: { where: { kind: 'file' }, take: 1 } } }),
  ]);
  return { window: { live: state.phase === 'live' }, challenge };
}
