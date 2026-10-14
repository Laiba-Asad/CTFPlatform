import { BANNED_MESSAGE, SIGNUP_CLOSED_MESSAGE, describeNameProblem, nameKey, validateName, type SessionResponse } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config';
import { cookieNames, sessionCookieOptions } from '../lib/cookies';
import { FailureCooldown, toRetrySeconds, type CooldownStatus } from '../lib/cooldown';
import type { Db } from '../lib/db';
import { HttpError } from '../lib/http-error';
import { issueCsrfToken } from '../middleware/csrf';
import { getEventState } from '../services/event';
import { resolveLogin } from '../services/players';
import { getEffectiveSettings } from '../services/settings';
import { createSession, deleteSession, toSessionUser } from '../services/sessions';

const LoginBody = z.object({
  name: z.string().max(200),
  teamId: z.string().min(1).max(64),
});

const DIFFERENT_TEAM_MESSAGE =
  'This name is already registered with another team. Use the team you joined with, or ask an organizer.';
const NAME_UNAVAILABLE_MESSAGE = 'This name is not available. Please choose another, or ask an organizer.';
const TEAM_FULL_MESSAGE = 'That team is full. Please choose another team or ask an organizer.';

export function cooldownError(status: CooldownStatus, message: string) {
  return new HttpError(429, 'COOLDOWN', message, { retryAfterSeconds: toRetrySeconds(status.retryAfterMs) });
}

/**
 * Open-join login (no sign-up page, no pre-registration): a player enters a
 * name and picks a team; the first use creates the account, later uses sign
 * back into the same one. Names are unique across teams (case/space/accent
 * insensitive).
 *
 * Abuse controls, all keyed to survive a shared LAN IP:
 * - a per-(IP+name) and looser per-IP failure cooldown (<= 30s) on rejected
 *   attempts (wrong team, unavailable name);
 * - a configurable new-accounts-per-IP rate limit (many players share one IP).
 */
export function authRouter(db: Db, config: AppConfig) {
  const router = Router();
  const names = cookieNames(config);
  const { cooldownMs, loginMaxFailures, loginMaxFailuresPerIp } = config.rateLimits;
  const perName = new FailureCooldown({ maxFailures: loginMaxFailures, cooldownMs });
  const perIp = new FailureCooldown({ maxFailures: loginMaxFailuresPerIp, cooldownMs });
  // New-account creations per IP in a sliding window.
  const creations = new Map<string, number[]>();

  router.get('/session', (req, res) => {
    const body: SessionResponse = {
      user: req.user ?? null,
      banned: req.banned ?? false,
      bannedReason: req.bannedReason ?? null,
      csrfToken: issueCsrfToken(req, res, config),
    };
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.post('/login', async (req, res) => {
    const { name, teamId } = LoginBody.parse(req.body);

    const problem = validateName(name);
    if (problem) {
      throw new HttpError(400, 'VALIDATION_FAILED', describeNameProblem(problem), {
        fields: [{ path: 'name', message: describeNameProblem(problem) }],
      });
    }

    const ip = req.ip ?? 'unknown';
    const key = `${ip}|${nameKey(name)}`;
    const blocked = longest(perName.check(key), perIp.check(ip));
    if (blocked.locked) throw cooldownError(blocked, 'Too many attempts. Please wait.');

    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) {
      recordFailure();
      throw new HttpError(400, 'UNKNOWN_TEAM', 'Choose a team from the list.');
    }

    // Sign-ups can be locked: existing players still log in, new names cannot join.
    // Either manually (settings.signupLocked) or automatically N minutes after the
    // event starts (CLOSE_SIGNUPS_AFTER_MINUTES).
    const settings = await getEffectiveSettings(db, config);
    const existing = await db.user.findUnique({ where: { nameKey: nameKey(name) } });
    const eventState = await getEventState(db);
    const signupsClosedByTime =
      config.event.closeSignupsAfterMs != null &&
      eventState.status === 'live' &&
      eventState.startedAt != null &&
      Date.now() - eventState.startedAt.getTime() > config.event.closeSignupsAfterMs;
    if (!existing && (settings.signupLocked || signupsClosedByTime)) {
      throw new HttpError(403, 'SIGNUP_LOCKED', SIGNUP_CLOSED_MESSAGE);
    }
    if (existing && existing.status === 'banned') {
      throw new HttpError(403, 'BANNED', BANNED_MESSAGE);
    }

    const resolution = await resolveLogin(db, config, {
      name,
      teamId,
      ip,
      allowCreate: () => allowCreation(ip),
      maxPlayersPerTeam: settings.maxPlayersPerTeam,
    });

    if (resolution.kind === 'different_team') return fail(409, 'DIFFERENT_TEAM', DIFFERENT_TEAM_MESSAGE);
    if (resolution.kind === 'name_unavailable') return fail(409, 'NAME_UNAVAILABLE', NAME_UNAVAILABLE_MESSAGE);
    if (resolution.kind === 'team_full') return fail(409, 'TEAM_FULL', TEAM_FULL_MESSAGE);
    if (resolution.kind === 'team_locked') return fail(409, 'TEAM_LOCKED', 'That team is closed to new players. Pick another team.');
    if (resolution.kind === 'rate_limited') {
      req.log.warn({ event: 'new_player_rate_limited', ip }, 'new-player creation rate limit hit');
      throw new HttpError(429, 'TOO_MANY_NEW_PLAYERS', 'Too many new players from this network. Please wait a few minutes.', {
        retryAfterSeconds: 60,
      });
    }

    const user = resolution.user;
    perName.reset(key);

    // Never reuse a pre-existing session id (session fixation).
    if (req.sessionToken) await deleteSession(db, req.sessionToken);
    const token = await createSession(db, user.id, config.sessionTtlMs);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.cookie(names.session, token, sessionCookieOptions(config));
    const body: SessionResponse = { user: toSessionUser(user), csrfToken: issueCsrfToken(req, res, config, true) };
    req.log.info({ event: resolution.kind === 'created' ? 'player_created' : 'login', userId: user.id }, 'login');
    res.json(body);

    function fail(status: number, code: string, message: string): void {
      recordFailure();
      req.log.info({ event: 'login_rejected', code, ip }, 'login rejected');
      const after = longest(perName.check(key), perIp.check(ip));
      if (after.locked) throw cooldownError(after, message);
      throw new HttpError(status, code, message);
    }

    function recordFailure() {
      perName.recordFailure(key);
      perIp.recordFailure(ip);
    }
  });

  router.post('/logout', async (req, res) => {
    if (req.sessionToken) await deleteSession(db, req.sessionToken);
    res.clearCookie(names.session, { ...sessionCookieOptions(config), maxAge: undefined });
    const body: SessionResponse = { user: null, csrfToken: issueCsrfToken(req, res, config, true) };
    res.json(body);
  });

  return router;

  /** Records a creation for this IP and returns whether it is still within the allowance. */
  function allowCreation(ip: string): boolean {
    if (!config.login.newPlayersPerIp.enabled) return true;
    const now = Date.now();
    const { max, windowMs } = config.login.newPlayersPerIp;
    const hits = (creations.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      creations.set(ip, hits);
      return false;
    }
    hits.push(now);
    creations.set(ip, hits);
    return true;
  }
}

function longest(a: CooldownStatus, b: CooldownStatus): CooldownStatus {
  return a.retryAfterMs >= b.retryAfterMs ? a : b;
}
