/**
 * npm run backup
 *
 * Copies the database to a timestamped snapshot in BACKUP_DIR (default backups/,
 * configurable to a USB drive). Keeps the most recent 20. Safe to run any time;
 * the snapshot is a consistent SQLite copy.
 */
import { loadConfig } from '../config';
import { backupSqlite } from '../lib/backup';
import { runScript } from './cli';

runScript(async () => {
  const config = loadConfig();
  const dest = await backupSqlite(config.databaseUrl, 20, undefined, config.backupDir);
  if (dest) console.log(`Backed up to ${dest}`);
  else console.log('No SQLite database to back up (PostgreSQL deploy: use pg_dump).');
});
