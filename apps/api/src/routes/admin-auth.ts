import type { AdminSessionResponse } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config';
import { adminSessionCookieOptions, cookieNames } from '../lib/cookies';
import { toRetrySeconds } from '../lib/cooldown';
import type { Db } from '../lib/db';
import { HttpError } from '../lib/http-error';
import { verifyPassword } from '../lib/password';
import { issueCsrfToken } from '../middleware/csrf';
import { audit } from '../services/audit';
import { createAdminSession, deleteAdminSession, toAdminMe } from '../services/admin-sessions';

const LoginBody = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200) });

/** Admin login: separate credentials, cookie, CSRF and lockout from the player side. */
export function adminAuthRouter(db: Db, config: AppConfig) {
  const router = Router();
  const names = cookieNames(config);
  // 5 failures per (IP+username), plus a looser per-IP cap; 15-minute lockout.
  const perUser = new FailureCooldownLong(config.admin.loginMaxFailures, config.admin.lockoutMs);
  const perIp = new FailureCooldownLong(config.admin.loginMaxFailures * 4, config.admin.lockoutMs);

  router.get('/session', (req, res) => {
    const body: AdminSessionResponse = { admin: req.admin ?? null, csrfToken: issueCsrfToken(req, res, config, false, 'admin') };
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.post('/login', async (req, res) => {
    const { username, password } = LoginBody.parse(req.body);
    const ip = req.ip ?? 'unknown';
    const key = `${ip}|${username.toLowerCase()}`;

    const blocked = worse(perUser.check(key), perIp.check(ip));
    if (blocked.lockedMs > 0) {
      throw new HttpError(429, 'LOCKED_OUT', 'Too many attempts. Try again later.', { retryAfterSeconds: toRetrySeconds(blocked.lockedMs) });
    }

    const admin = await db.adminAccount.findUnique({ where: { usernameKey: username.trim().toLowerCase() } });
    const ok = admin && !admin.disabled && (await verifyPassword(password, admin.passwordHash));
    if (!ok || !admin) {
      perUser.fail(key);
      perIp.fail(ip);
      req.log.warn({ event: 'admin_login_failed', ip }, 'admin login failed');
      throw new HttpError(401, 'LOGIN_FAILED', 'Invalid username or password.');
    }

    perUser.reset(key);
    if (req.adminSessionToken) await deleteAdminSession(db, req.adminSessionToken);
    const token = await createAdminSession(db, admin.id, config, ip);
    await db.adminAccount.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    res.cookie(names.adminSession, token, adminSessionCookieOptions(config));
    await audit(db, { admin: admin.username, action: 'admin.login', ip });
    req.log.info({ event: 'admin_login', admin: admin.username }, 'admin login');
    const body: AdminSessionResponse = { admin: toAdminMe(admin), csrfToken: issueCsrfToken(req, res, config, true, 'admin') };
    res.json(body);
  });

  router.post('/logout', async (req, res) => {
    if (req.adminSessionToken) await deleteAdminSession(db, req.adminSessionToken);
    res.clearCookie(names.adminSession, { ...adminSessionCookieOptions(config), maxAge: undefined });
    const body: AdminSessionResponse = { admin: null, csrfToken: issueCsrfToken(req, res, config, true, 'admin') };
    res.json(body);
  });

  return router;
}

interface LockStatus {
  lockedMs: number;
}
function worse(a: LockStatus, b: LockStatus): LockStatus {
  return a.lockedMs >= b.lockedMs ? a : b;
}

/**
 * Like FailureCooldown but for the admin lockout, whose window (15 min) exceeds
 * the 30s cap FailureCooldown enforces for player cooldowns.
 */
class FailureCooldownLong {
  private readonly entries = new Map<string, { failures: number; lockedUntil: number; last: number }>();
  constructor(
    private readonly maxFailures: number,
    private readonly lockoutMs: number,
  ) {}
  check(key: string): LockStatus {
    const e = this.entries.get(key);
    if (!e) return { lockedMs: 0 };
    return { lockedMs: Math.max(0, e.lockedUntil - Date.now()) };
  }
  fail(key: string): void {
    const now = Date.now();
    const e = this.entries.get(key) ?? { failures: 0, lockedUntil: 0, last: now };
    if (now - e.last > this.lockoutMs) e.failures = 0;
    e.failures += 1;
    e.last = now;
    if (e.failures >= this.maxFailures) e.lockedUntil = now + this.lockoutMs;
    this.entries.set(key, e);
  }
  reset(key: string): void {
    this.entries.delete(key);
  }
}
