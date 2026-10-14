#!/usr/bin/env node
/**
 * Runs before `npm run dev`: generates the Prisma client, applies all
 * migrations, seeds an empty database, and in development refreshes the event
 * to the configured mode (default live) so `npm run dev` is always testable.
 * Teams, challenges (and their release state), players and scores are preserved;
 * only the event row's mode/window is refreshed. Never seeds in production.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const run = (args) => execFileSync(process.execPath, args, { cwd: apiRoot, stdio: 'inherit' });

const prisma = require.resolve('prisma/build/index.js');
run([prisma, 'generate']);
run([prisma, 'migrate', 'deploy']);
if (process.env.NODE_ENV !== 'production') {
  const tsx = require.resolve('tsx/cli');
  // --update-event refreshes the event mode/window (upserts teams/challenges,
  // never creates or deletes players). Pin EVENT_MODE in .env to override.
  run([tsx, 'src/scripts/seed.ts', '--update-event']);
  // Create the dev admin from DEV_ADMIN_* in .env, but only if no admin exists
  // yet (never overwrites a real account). Skips quietly if the vars are unset.
  try {
    run([tsx, 'src/scripts/admin-seed-dev.ts', '--if-none']);
  } catch {
    // DEV_ADMIN_USERNAME/PASSWORD not set: fine, use `npm run admin:create`.
  }
}
