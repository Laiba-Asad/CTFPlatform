import { defineConfig } from 'prisma/config';
import { DEFAULT_DATABASE_URL, loadDotEnv, normalizeDatabaseUrl, providerFor } from './src/db-url';

loadDotEnv();

const url = normalizeDatabaseUrl(process.env.DATABASE_URL || DEFAULT_DATABASE_URL);
const postgres = providerFor(url) === 'postgresql';

// SQLite (dev) uses prisma/schema.prisma; PostgreSQL uses the derived copy
// in prisma/postgresql/ with its own migration history.
export default defineConfig({
  schema: postgres ? 'prisma/postgresql/schema.prisma' : 'prisma/schema.prisma',
  migrations: {
    path: postgres ? 'prisma/postgresql/migrations' : 'prisma/migrations',
  },
  datasource: { url },
});
