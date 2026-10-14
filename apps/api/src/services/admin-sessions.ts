import type { AdminMe, AdminRole } from '@cydemic/shared';
import type { AppConfig } from '../config';
import { randomToken, sha256 } from '../lib/crypto';
import type { Db } from '../lib/db';

type AdminRow = { id: string; username: string; role: string; disabled: boolean };

export function toAdminMe(admin: AdminRow): AdminMe {
  return { username: admin.username, role: admin.role as AdminRole };
}

/** Create an admin session; returns the raw token for the cookie (only its hash is stored). */
export async function createAdminSession(db: Db, adminId: string, config: AppConfig, ip: string | null): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await db.adminSession.create({
    data: {
      id: sha256(token),
      adminId,
      ip,
      expiresAt: new Date(now + config.admin.idleTimeoutMs),
      absoluteExpiresAt: new Date(now + config.admin.maxSessionMs),
    },
  });
  return token;
}

/**
 * Find a valid admin session and slide the idle timeout. Enforces both the idle
 * timeout (expiresAt) and the absolute max session age. Returns null if invalid.
 */
export async function findAdminSession(db: Db, token: string, config: AppConfig) {
  const session = await db.adminSession.findUnique({ where: { id: sha256(token) }, include: { admin: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now || session.admin.disabled) {
    await db.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Slide the idle timeout, but never past the absolute cap.
  const nextIdle = Math.min(now + config.admin.idleTimeoutMs, session.absoluteExpiresAt.getTime());
  await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt: new Date(nextIdle) } });
  return session;
}

export async function deleteAdminSession(db: Db, token: string): Promise<void> {
  await db.adminSession.deleteMany({ where: { id: sha256(token) } });
}

export async function purgeExpiredAdminSessions(db: Db): Promise<number> {
  const { count } = await db.adminSession.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { absoluteExpiresAt: { lte: new Date() } }] } });
  return count;
}
