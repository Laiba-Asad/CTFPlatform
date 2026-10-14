/**
 * npm run reset [-- --yes]
 *
 * DESTRUCTIVE: drops every table (all players, scores, solves and submissions),
 * re-applies migrations and re-seeds. Backs the database up first, and requires
 * an interactive confirmation (type DELETE) or --yes.
 */
import { loadConfig } from '../config';
import { normalizeDatabaseUrl } from '../db-url';
import { backupSqlite } from '../lib/backup';
import { createDb } from '../lib/db';
import { seed } from '../seeding/seed';
import { confirmDestructive, prismaCli, runScript } from './cli';

runScript(async () => {
  const config = loadConfig();
  const url = normalizeDatabaseUrl(config.databaseUrl);

  const backup = await backupSqlite(url, 10);
  if (backup) console.log(`Backed up current database to ${backup}`);

  const ok = await confirmDestructive(
    'reset will DELETE ALL players, scores, solves and submissions, then re-seed.',
  );
  if (!ok) {
    console.log('Aborted. Nothing was changed.');
    return;
  }

  console.log('Resetting database...');
  prismaCli(['migrate', 'reset', '--force'], { ...process.env, DATABASE_URL: url });

  const db = createDb(url);
  try {
    await seed(db, config, { log: console.log, updateEvent: true });
  } finally {
    await db.$disconnect();
  }
  console.log('Reset complete.');
});
