import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizeDatabaseUrl, providerFor } from '../db-url';
import { PrismaClient } from '../generated/prisma/client';

export type Db = PrismaClient;

/**
 * The generated client matches the provider chosen at `prisma generate` time
 * (from DATABASE_URL). Switching between SQLite and PostgreSQL means changing
 * DATABASE_URL and re-running `npm run db:generate`.
 */
export function createDb(databaseUrl: string): Db {
  const url = normalizeDatabaseUrl(databaseUrl);
  const adapter =
    providerFor(url) === 'sqlite' ? new PrismaBetterSqlite3({ url }) : new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

/**
 * SQLite tuning for many concurrent players: WAL lets readers and a writer work
 * at once, and a busy timeout makes brief lock contention wait instead of
 * erroring. No-op on PostgreSQL.
 */
export async function initDb(db: Db, databaseUrl: string): Promise<void> {
  if (providerFor(normalizeDatabaseUrl(databaseUrl)) !== 'sqlite') return;
  await db.$executeRawUnsafe('PRAGMA journal_mode = WAL');
  await db.$executeRawUnsafe('PRAGMA busy_timeout = 5000');
  await db.$executeRawUnsafe('PRAGMA synchronous = NORMAL');
}
