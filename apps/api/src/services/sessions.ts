import type { Role, SessionUser } from '@cydemic/shared';
import type { Db } from '../lib/db';
import { randomToken, sha256 } from '../lib/crypto';

type UserWithTeam = {
  id: string;
  name: string;
  role: string;
  team: { id: string; name: string; avatar: string; tagline: string };
};

export function toSessionUser(user: UserWithTeam): SessionUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role as Role,
    team: { id: user.team.id, name: user.team.name, avatar: user.team.avatar, tagline: user.team.tagline },
  };
}

/** Creates a session and returns the raw token for the cookie. Only its hash is stored. */
export async function createSession(db: Db, userId: string, ttlMs: number): Promise<string> {
  const token = randomToken();
  await db.session.create({
    data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

export async function findSession(db: Db, token: string) {
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { team: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sha256(token) } });
}

export async function purgeExpiredSessions(db: Db): Promise<number> {
  const { count } = await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return count;
}
