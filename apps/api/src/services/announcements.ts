import type { PlayerAnnouncement } from '@cydemic/shared';
import type { Db } from '../lib/db';

/** The most recent active, unexpired announcement for the player banner (or null). */
export async function activePlayerAnnouncement(db: Db): Promise<PlayerAnnouncement | null> {
  const now = new Date();
  const row = await db.announcement.findFirst({
    where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });
  return row ? { id: row.id, title: row.title, body: row.body } : null;
}
