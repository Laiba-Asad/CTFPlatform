/**
 * npm run dev:clean-players [-- --yes]
 *
 * Removes all players and their sessions, solves and submissions, but KEEPS
 * teams, challenges (and their release state) and the event. Backs up first and
 * requires confirmation. Use to clear old sample players from a dev database.
 */
import { loadConfig } from '../config';
import { normalizeDatabaseUrl } from '../db-url';
import { backupSqlite } from '../lib/backup';
import { createDb } from '../lib/db';
import { confirmDestructive, runScript } from './cli';

runScript(async () => {
  const config = loadConfig();
  const url = normalizeDatabaseUrl(config.databaseUrl);
  const db = createDb(url);
  try {
    const players = await db.user.count({ where: { role: 'player' } });
    const admins = await db.user.count({ where: { role: 'admin' } });
    console.log(`Found ${players} player(s) and ${admins} admin(s).`);
    if (players === 0) {
      console.log('No players to remove.');
      return;
    }

    const backup = await backupSqlite(url, 10);
    if (backup) console.log(`Backed up current database to ${backup}`);

    const ok = await confirmDestructive(
      `This will DELETE ${players} player(s) and their sessions, solves and submissions. Teams, challenges and the event are kept.`,
    );
    if (!ok) {
      console.log('Aborted. Nothing was changed.');
      return;
    }

    // Deleting the users cascades to their sessions, solves, submissions, hint unlocks and achievements.
    const { count } = await db.user.deleteMany({ where: { role: 'player' } });
    console.log(`Removed ${count} player(s). Teams, challenges and event are unchanged.`);
  } finally {
    await db.$disconnect();
  }
});
