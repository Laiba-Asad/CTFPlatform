import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type { Logger } from 'pino';
import { API_ROOT, normalizeDatabaseUrl, providerFor, sqlitePath } from '../db-url';

export const BACKUP_DIR = join(API_ROOT, 'backups');

/** Resolve a backup directory: absolute as-is, relative against the repo root. */
export function resolveBackupDir(dir?: string): string {
  if (!dir) return BACKUP_DIR;
  return isAbsolute(dir) ? dir : resolve(API_ROOT, '../..', dir);
}

/**
 * Consistent SQLite snapshot into `dir` (default apps/api/backups), keeping the
 * most recent `keep`. No-op for PostgreSQL (use pg_dump there). Never throws.
 */
export async function backupSqlite(databaseUrl: string, keep = 10, logger?: Logger, dir?: string): Promise<string | null> {
  const url = normalizeDatabaseUrl(databaseUrl);
  if (providerFor(url) !== 'sqlite') return null;
  const src = sqlitePath(url);
  if (!existsSync(src)) return null;

  const outDir = resolveBackupDir(dir);
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(outDir, `ctf-${stamp}.db`);
  try {
    const db = new Database(src, { readonly: true });
    await db.backup(dest);
    db.close();
  } catch (err) {
    logger?.warn({ err }, 'database backup failed');
    return null;
  }
  prune(outDir, keep);
  logger?.info(`Database backed up to ${dest}`);
  return dest;
}

function prune(dir: string, keep: number): void {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('ctf-') && f.endsWith('.db'))
    .sort(); // ISO timestamps sort chronologically
  for (const f of files.slice(0, Math.max(0, files.length - keep))) {
    rmSync(join(dir, f), { force: true });
  }
}
