import type { AdminMe } from '@cydemic/shared';
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config';
import { cookieNames } from '../lib/cookies';
import type { Db } from '../lib/db';
import { forbidden, unauthorized } from '../lib/http-error';
import { ipInAnyCidr, normalizeIp } from '../lib/ip';
import { findAdminSession, toAdminMe } from '../services/admin-sessions';

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminMe;
    adminSessionToken?: string;
  }
}

/** Reads the admin session cookie and attaches req.admin. Never rejects by itself. */
export function loadAdminSession(db: Db, config: AppConfig): RequestHandler {
  const { adminSession: cookie } = cookieNames(config);
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[cookie];
    if (typeof token === 'string' && token.length > 0 && token.length < 200) {
      const session = await findAdminSession(db, token, config);
      if (session) {
        req.admin = toAdminMe(session.admin);
        req.adminSessionToken = token;
      }
    }
    next();
  };
}

/**
 * Restrict the admin area to organizer machines. Default (no ADMIN_ALLOWED_SUBNETS)
 * is localhost only, so players on the LAN cannot reach /admin or /api/admin.
 */
export function adminSubnetGuard(config: AppConfig): RequestHandler {
  const cidrs = config.admin.allowedSubnets;
  return (req, _res, next) => {
    const ip = normalizeIp(req.ip ?? '');
    const isLocal = ip === '127.0.0.1' || ip === '::1';
    if (isLocal || (cidrs.length > 0 && ipInAnyCidr(ip, cidrs))) return next();
    req.log?.warn({ ip }, 'admin access from a disallowed address');
    next(forbidden('The admin area is not available from your network.'));
  };
}

/** Any signed-in admin (admin or viewer). Use for read-only admin endpoints. */
export const requireAdminAuth: RequestHandler = (req, _res, next) => {
  next(req.admin ? undefined : unauthorized('Admin sign in required'));
};

/** Full admin only (role=admin). Viewers are rejected for mutations. */
export const requireAdminRole: RequestHandler = (req, _res, next) => {
  if (!req.admin) return next(unauthorized('Admin sign in required'));
  next(req.admin.role === 'admin' ? undefined : forbidden('This action requires an admin (not viewer) account.'));
};
