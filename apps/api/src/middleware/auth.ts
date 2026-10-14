import { BANNED_MESSAGE, type SessionUser } from '@cydemic/shared';
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config';
import { cookieNames } from '../lib/cookies';
import type { Db } from '../lib/db';
import { HttpError, unauthorized } from '../lib/http-error';
import { findSession, toSessionUser } from '../services/sessions';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by loadSession when a valid session cookie belongs to an active player */
    user?: SessionUser;
    /** Raw session token from the cookie (for logout) */
    sessionToken?: string;
    /** True when the cookie belongs to a banned player */
    banned?: boolean;
    bannedReason?: string | null;
  }
}

/**
 * Reads the session cookie and attaches the user. A banned player is recognised
 * but not attached as an active user, so they are effectively signed out. Also
 * refreshes last-seen for the "active now" admin view. Never rejects by itself.
 */
export function loadSession(db: Db, config: AppConfig): RequestHandler {
  const { session: cookie } = cookieNames(config);
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[cookie];
    if (typeof token === 'string' && token.length > 0 && token.length < 200) {
      const session = await findSession(db, token);
      if (session) {
        req.sessionToken = token;
        if (session.user.status === 'banned') {
          req.banned = true;
          req.bannedReason = session.user.bannedReason ?? null;
        } else {
          req.user = toSessionUser(session.user);
          // Fire-and-forget last-seen update (don't block the request).
          void db.user.update({ where: { id: session.user.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
        }
      }
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.banned) return next(new HttpError(403, 'BANNED', BANNED_MESSAGE));
  next(req.user ? undefined : unauthorized());
};
