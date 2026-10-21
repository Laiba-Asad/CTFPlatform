/**
 * npm run restore -- <backup-file>
 *
 * Restores the database from a snapshot. Takes a SAFETY backup of the current
 * database first, verifies the snapshot's integrity, then replaces the live DB.
 * Asks for confirmation (type RESTORE) unless --yes is passed.
 */
import Database from 'better-sqlite3';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config';
import { normalizeDatabaseUrl, providerFor, sqlitePath } from '../db-url';
import { backupSqlite } from '../lib/backup';
import { confirmDestructive, runScript } from './cli';

runScript(async () => {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Usage: npm run restore -- <backup-file> [--yes]');
  const src = resolve(process.cwd(), file);
  if (!existsSync(src)) throw new Error(`Backup not found: ${src}`);

  const config = loadConfig();
  const url = normalizeDatabaseUrl(config.databaseUrl);
  if (providerFor(url) !== 'sqlite') throw new Error('restore supports SQLite only (PostgreSQL: restore with your DB tools).');
  const live = sqlitePath(url);

  // Verify the snapshot opens and passes an integrity check before we touch the live DB.
  const check = new Database(src, { readonly: true });
  const integrity = check.pragma('integrity_check', { simple: true });
  const challenges = check.prepare('SELECT COUNT(*) n FROM Challenge').get() as { n: number };
  check.close();
  if (integrity !== 'ok') throw new Error(`Snapshot failed integrity check: ${integrity}`);
  console.log(`Snapshot OK (${challenges.n} challenges). Current database will be replaced.`);

  const safety = await backupSqlite(config.databaseUrl, 100_000, undefined, config.backupDir);
  if (safety) console.log(`Safety backup of the current database: ${safety}`);

  const ok = await confirmDestructive('This replaces the live database with the chosen snapshot.', 'RESTORE');
  if (!ok) {
    console.log('Aborted. Nothing was changed.');
    return;
  }

  // Replace the live DB and clear any stale WAL/SHM sidecars (the snapshot is a
  // self-contained copy; leftover sidecars would corrupt the view).
  copyFileSync(src, live);
  for (const sidecar of [`${live}-wal`, `${live}-shm`]) {
    if (existsSync(sidecar)) rmSync(sidecar, { force: true });
  }
  console.log(`Restored ${live} from ${src}. Restart the platform so it reloads the database.`);
});
