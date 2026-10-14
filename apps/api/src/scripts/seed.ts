/**
 * npm run seed [-- --update-event] [-- --if-empty]
 *
 * Idempotent: teams and challenges are upserted and the event is created once
 * (use --update-event to overwrite its dates). Players are never pre-created;
 * they join themselves on first login.
 */
import { loadConfig } from '../config';
import { createDb } from '../lib/db';
import { seed } from '../seeding/seed';
import { hasFlag, runScript } from './cli';

runScript(async () => {
  const config = loadConfig();
  const db = createDb(config.databaseUrl);
  try {
    if (hasFlag('--if-empty') && (await db.team.count()) > 0) {
      console.log('Database already seeded.');
      return;
    }
    await seed(db, config, { updateEvent: hasFlag('--update-event'), log: console.log });
    console.log('Seed complete.');
  } finally {
    await db.$disconnect();
  }
});
