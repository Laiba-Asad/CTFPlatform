import type { Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../config';
import { cookieNames, csrfCookieOptions } from '../lib/cookies';
import { hmac, randomToken, safeEqual } from '../lib/crypto';
import { HttpError } from '../lib/http-error';

/*
 * Signed double-submit CSRF protection (OWASP recommended for cookie sessions):
 *  - an httpOnly random value lives in a SameSite=Strict cookie;
 *  - the token the client must echo in X-CSRF-Token is HMAC(secret, value),
 *    delivered only in JSON bodies, which cross-site pages cannot read.
 * The player and admin areas use separate cookies (see `which`).
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type Which = 'player' | 'admin';

function cookieFor(config: AppConfig, which: Which): string {
  const names = cookieNames(config);
  return which === 'admin' ? names.adminCsrf : names.csrf;
}

export function issueCsrfToken(req: Request, res: Response, config: AppConfig, rotate = false, which: Which = 'player'): string {
  const cookie = cookieFor(config, which);
  let value: unknown = req.cookies?.[cookie];
  if (rotate || typeof value !== 'string' || value.length < 20) {
    value = randomToken();
    res.cookie(cookie, value, csrfCookieOptions(config));
  }
  return hmac(config.sessionSecret, `csrf:${value as string}`);
}

export function csrfProtection(config: AppConfig, which: Which = 'player'): RequestHandler {
  const cookie = cookieFor(config, which);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    // Defense in depth: reject browsers posting from a foreign origin.
    const origin = req.get('origin');
    if (origin && !config.allowedOrigins.includes(origin) && origin !== `${req.protocol}://${req.get('host')}`) {
      return next(new HttpError(403, 'CSRF_FAILED', 'Request origin not allowed'));
    }

    const value: unknown = req.cookies?.[cookie];
    const header = req.get('x-csrf-token');
    const valid =
      typeof value === 'string' && typeof header === 'string' && safeEqual(header, hmac(config.sessionSecret, `csrf:${value}`));
    next(valid ? undefined : new HttpError(403, 'CSRF_FAILED', 'Your session expired. Reload the page and try again.'));
  };
}
