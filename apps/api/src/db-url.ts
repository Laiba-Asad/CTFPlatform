import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** apps/api, regardless of the current working directory */
export const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type DbProvider = 'sqlite' | 'postgresql';

export const DEFAULT_DATABASE_URL = 'file:./dev.db';

/** Load the repo-root .env (or apps/api/.env) without overriding real env vars. */
export function loadDotEnv(): void {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(API_ROOT, '.env'), resolve(API_ROOT, '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

export function providerFor(url: string): DbProvider {
  if (url.startsWith('file:')) return 'sqlite';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgresql';
  throw new Error('DATABASE_URL must start with file: (SQLite) or postgresql:// (PostgreSQL)');
}

/** Relative SQLite paths are resolved from apps/api so every tool agrees on the file. */
export function normalizeDatabaseUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const path = url.slice('file:'.length);
  return `file:${isAbsolute(path) ? path : resolve(API_ROOT, path)}`;
}

export function sqlitePath(url: string): string {
  return normalizeDatabaseUrl(url).slice('file:'.length);
}
