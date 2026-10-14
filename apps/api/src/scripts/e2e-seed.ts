/**
 * Prepare the end-to-end test database (separate from dev): teams, the event
 * (waiting), one simple solvable challenge with a known flag, and the E2E admin
 * account. Driven by E2E_* env from the Playwright config. Dev/test only.
 */
import { loadConfig } from '../config';
import { normalizeDatabaseUrl } from '../db-url';
import { createDb } from '../lib/db';
import { seedDevAdmin } from '../services/admin-accounts';
import { hashFlag } from '../services/flags';
import { seed } from '../seeding/seed';
import { runScript } from './cli';

/** Public to the E2E suite only (not a real event flag). */
export const E2E_FLAG = 'CYFLAG{e2e-demo-flag}';

runScript(async () => {
  const config = loadConfig();
  if (config.isProd) throw new Error('e2e-seed is for development/testing only.');
  const db = createDb(normalizeDatabaseUrl(config.databaseUrl));
  try {
    // Teams + event (EVENT_MODE=scheduled → waiting) from seed/*.json.
    await seed(db, config, { updateEvent: true, log: () => {} });

    // A simple, always-available challenge (no service port) with a known flag.
    const { salt, hash } = hashFlag(config.flagPepper, E2E_FLAG);
    const base = { number: 1, title: 'Warmup', description: 'Submit the demo flag to score.', category: 'WEB', difficulty: 1, points: 100, flagHash: hash, flagSalt: salt, port: null, released: true, visible: true };
    await db.challenge.upsert({ where: { id: 'web1' }, create: { id: 'web1', ...base }, update: base });

    const username = process.env.E2E_ADMIN_USER;
    const password = process.env.E2E_ADMIN_PASS;
    if (!username || !password) throw new Error('E2E_ADMIN_USER / E2E_ADMIN_PASS must be set.');
    await seedDevAdmin(db, { username, password });

    console.log('E2E database ready.');
  } finally {
    await db.$disconnect();
  }
});
