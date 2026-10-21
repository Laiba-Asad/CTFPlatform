import type { AdminMe } from '@cydemic/shared';
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config';
import { cookieNames } from '../lib/cookies';
import type { Db } from '../lib/db';
import { forbidden, notFound, unauthorized } from '../lib/http-error';
import { ipInAnyCidr, normalizeIp } from '../lib/ip';
import { findAdminSession, toAdminMe } from '../services/admin-sessions';

/**
 * True when the request's client IP may reach the admin area. Localhost is
 * always allowed; otherwise the IP must be in ADMIN_ALLOWED_IPS (exact match)
 * or, for backward compatibility, inside an ADMIN_ALLOWED_SUBNETS range.
 */
export function adminIpAllowed(config: AppConfig, rawIp: string): boolean {
  const ip = normalizeIp(rawIp);
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (config.admin.allowedIps.includes(ip)) return true;
  return config.admin.allowedSubnets.length > 0 && ipInAnyCidr(ip, config.admin.allowedSubnets);
}

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
  return (req, _res, next) => {
    if (adminIpAllowed(config, req.ip ?? '')) return next();
    req.log?.warn({ ip: normalizeIp(req.ip ?? '') }, 'admin access from a disallowed address');
    // In production, return 404 so players on the LAN cannot even tell the admin
    // area exists. In dev, 403 is friendlier for the organizer debugging access.
    next(config.isProd ? notFound('Not found') : forbidden('The admin area is not available from your network.'));
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
