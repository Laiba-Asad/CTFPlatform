/**
 * npm run challenges:retire [-- --yes]
 *
 * Removes the retired challenges (src/challenges/retired.ts) from an existing
 * database together with their solves, submissions, hints and attachments, then
 * prints the counts and the score totals before/after (scores are derived by
 * the single scoring function, so they recompute automatically).
 *
 * Backs up the database first (prints the path) and requires typing RETIRE (or --yes).
 * Idempotent: on a database without retired challenges it changes nothing.
 */
import { loadConfig } from '../config';
import { RETIRED_CHALLENGE_IDS } from '../challenges/retired';
import { normalizeDatabaseUrl } from '../db-url';
import { backupSqlite } from '../lib/backup';
import { createDb } from '../lib/db';
import { audit } from '../services/audit';
import { retireChallenges } from '../services/retire';
import { aggregatePlayers } from '../services/scoring';
import { confirmDestructive, runScript } from './cli';

runScript(async () => {
  const config = loadConfig();
  const url = normalizeDatabaseUrl(config.databaseUrl);
  const db = createDb(url);
  try {
    const present = await db.challenge.findMany({ where: { id: { in: [...RETIRED_CHALLENGE_IDS] } }, select: { id: true } });
    if (present.length === 0) {
      console.log(`No retired challenges in the database (${RETIRED_CHALLENGE_IDS.join(', ')}). Nothing to do.`);
      return;
    }
    console.log(`Retired challenges present: ${present.map((c) => c.id).join(', ')}`);

    // keep = Infinity-ish: never prune older backups while retiring.
    const backup = await backupSqlite(url, 100_000);
    if (backup) console.log(`Backed up current database to ${backup}`);
    else if (url.startsWith('file:')) throw new Error('Database backup failed; nothing was changed.');
    else console.log('PostgreSQL: take a pg_dump before continuing.');

    const ok = await confirmDestructive('This deletes the retired challenges and every solve/submission on them.', 'RETIRE');
    if (!ok) {
      console.log('Aborted. Nothing was changed.');
      return;
    }

    const total = (aggs: Awaited<ReturnType<typeof aggregatePlayers>>) => aggs.reduce((s, a) => s + a.score, 0);
    const before = await aggregatePlayers(db);
    const counts = await retireChallenges(db);
    const after = await aggregatePlayers(db);
    await audit(db, { admin: 'cli', action: 'mission.retire', after: { ids: RETIRED_CHALLENGE_IDS, ...counts } });

    console.log('Removed:');
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`);
    const changed = after.filter((a) => a.score !== before.find((b) => b.id === a.id)?.score).length;
    console.log(`Scores recomputed for ${after.length} players: total ${total(before)} -> ${total(after)} (${changed} players changed).`);
  } finally {
    await db.$disconnect();
  }
});
