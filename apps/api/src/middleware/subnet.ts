import type { RequestHandler } from 'express';
import type { AppConfig } from '../config';
import { ipInAnyCidr, normalizeIp } from '../lib/ip';
import { forbidden } from '../lib/http-error';

/**
 * Optional LAN guard: when ALLOWED_SUBNETS is set, only clients whose IP falls
 * in one of the CIDR ranges may reach the API. Loopback is always allowed so
 * local health checks and same-host tooling keep working.
 */
export function subnetGuard(config: AppConfig): RequestHandler {
  const cidrs = config.allowedSubnets;
  return (req, _res, next) => {
    if (cidrs.length === 0) return next();
    const ip = normalizeIp(req.ip ?? '');
    if (ip === '127.0.0.1' || ip === '::1' || ipInAnyCidr(ip, cidrs)) return next();
    req.log?.warn({ ip }, 'request from a disallowed subnet');
    next(forbidden('Your network is not allowed to access this server.'));
  };
}
