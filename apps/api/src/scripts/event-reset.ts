/**
 * npm run event:reset [-- --yes]
 *
 * Clears the event for a fresh run: removes all players, sessions, solves,
 * submissions, score adjustments and announcements, and resets the shared clock
 * to "waiting". KEEPS teams, challenges (and their release state), admin
 * accounts, settings and the audit log (a single audit entry records the reset).
 *
 * Backs up the database first and requires typing RESET (or --yes).
 */
import { loadConfig } from '../config';
import { normalizeDatabaseUrl } from '../db-url';
import { backupSqlite } from '../lib/backup';
import { createDb } from '../lib/db';
import { audit } from '../services/audit';
import { confirmDestructive, runScript } from './cli';

runScript(async () => {
  const config = loadConfig();
  const url = normalizeDatabaseUrl(config.databaseUrl);
  const db = createDb(url);
  try {
    const [players, sessions, solves, submissions, adjustments, announcements] = await Promise.all([
      db.user.count({ where: { role: 'player' } }),
      db.session.count(),
      db.solve.count(),
      db.submission.count(),
      db.scoreAdjustment.count(),
      db.announcement.count(),
    ]);
    console.log(`Will remove: ${players} players, ${sessions} sessions, ${solves} solves, ${submissions} submissions, ${adjustments} adjustments, ${announcements} announcements.`);
    console.log('Will keep: teams, challenges (release state), admin accounts, settings and the audit log. The event clock resets to "waiting".');

    const backup = await backupSqlite(url, 10);
    if (backup) console.log(`Backed up current database to ${backup}`);

    const ok = await confirmDestructive('This clears the event so you can start a fresh run.', 'RESET');
    if (!ok) {
      console.log('Aborted. Nothing was changed.');
      return;
    }

    // Deleting players cascades to their sessions, solves, submissions and adjustments.
    const removed = await db.$transaction([
      db.scoreAdjustment.deleteMany(),
      db.submission.deleteMany(),
      db.solve.deleteMany(),
      db.session.deleteMany(),
      db.announcement.deleteMany(),
      db.user.deleteMany({ where: { role: 'player' } }),
    ]);
    const now = Date.now();
    await db.event.updateMany({ data: { status: 'waiting', startedAt: null, pausedRemainingMs: null, endsAt: new Date(now + config.event.durationMs) } });
    await audit(db, { admin: '(cli)', action: 'event.reset', after: { players, solves, submissions, adjustments, announcements } });

    console.log(`Removed ${removed[5].count} players (and their ${solves} solves, ${submissions} submissions, ${adjustments} adjustments), ${removed[4].count} announcements and ${removed[3].count} sessions. The event clock is now "waiting".`);
  } finally {
    await db.$disconnect();
  }
});
