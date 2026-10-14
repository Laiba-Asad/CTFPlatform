import type { Request } from 'express';
import type { Db } from '../lib/db';

interface AuditInput {
  admin: string;
  action: string;
  target?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Append an audit entry. before/after are JSON-stringified; callers must never
 * pass flag values or password material. Append-only: never updated or deleted.
 */
export async function audit(db: Db, input: AuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      admin: input.admin,
      action: input.action,
      target: input.target ?? null,
      before: input.before === undefined ? null : JSON.stringify(input.before),
      after: input.after === undefined ? null : JSON.stringify(input.after),
      ip: input.ip ?? null,
    },
  });
}

/** Convenience for route handlers: pulls admin + ip from the request. */
export function auditFromReq(db: Db, req: Request, action: string, extra: Omit<AuditInput, 'admin' | 'action' | 'ip'> = {}) {
  return audit(db, { admin: req.admin?.username ?? 'unknown', action, ip: req.ip ?? null, ...extra });
}
