import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from 'pino';
import { API_ROOT, normalizeDatabaseUrl, providerFor, sqlitePath } from '../db-url';

export const BACKUP_DIR = join(API_ROOT, 'backups');

/**
 * Consistent SQLite snapshot into apps/api/backups, keeping the most recent
 * `keep`. No-op for PostgreSQL (use pg_dump there). Never throws into startup.
 */
export async function backupSqlite(databaseUrl: string, keep = 10, logger?: Logger): Promise<string | null> {
  const url = normalizeDatabaseUrl(databaseUrl);
  if (providerFor(url) !== 'sqlite') return null;
  const src = sqlitePath(url);
  if (!existsSync(src)) return null;

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(BACKUP_DIR, `ctf-${stamp}.db`);
  try {
    const db = new Database(src, { readonly: true });
    await db.backup(dest);
    db.close();
  } catch (err) {
    logger?.warn({ err }, 'database backup failed');
    return null;
  }
  prune(keep);
  logger?.info(`Database backed up to ${dest}`);
  return dest;
}

function prune(keep: number): void {
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('ctf-') && f.endsWith('.db'))
    .sort(); // ISO timestamps sort chronologically
  for (const f of files.slice(0, Math.max(0, files.length - keep))) {
    rmSync(join(BACKUP_DIR, f), { force: true });
  }
}
