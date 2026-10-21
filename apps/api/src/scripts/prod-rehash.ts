/**
 * npm run prod:rehash
 *
 * Recomputes the salted HMAC of every challenge flag using the CURRENT
 * FLAG_PEPPER (from the production .env) and writes the new salt+hash straight
 * into the database. Used by prod:init after a fresh pepper is generated, so the
 * stored hashes match the production pepper without touching tracked files.
 *
 * Reads plaintext flags only from challenge-services/.flags.env. Prints counts,
 * never values. Verifies every flag against its new stored hash before finishing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config';
import { API_ROOT, normalizeDatabaseUrl } from '../db-url';
import { createDb } from '../lib/db';
import { hashFlag, verifyFlag } from '../services/flags';
import { parseFlagsEnv } from '../services/production-guards';
import { runScript } from './cli';

const FLAGS_ENV = resolve(API_ROOT, '../..', 'challenge-services', '.flags.env');

runScript(async () => {
  if (!existsSync(FLAGS_ENV)) throw new Error(`Missing ${FLAGS_ENV}`);
  const config = loadConfig();
  if (config.usingDevSecrets) {
    throw new Error('FLAG_PEPPER is not set (using the development pepper). Set a real FLAG_PEPPER first.');
  }
  const flags = parseFlagsEnv(readFileSync(FLAGS_ENV, 'utf8'));
  const db = createDb(normalizeDatabaseUrl(config.databaseUrl));
  try {
    const challenges = await db.challenge.findMany({ select: { id: true } });
    if (challenges.length === 0) throw new Error('No challenges in the database. Seed first.');
    let rehashed = 0;
    const missing: string[] = [];
    for (const c of challenges) {
      const plain = flags[`FLAG_${c.id}`];
      if (!plain) {
        missing.push(c.id);
        continue;
      }
      const { salt, hash } = hashFlag(config.flagPepper, plain);
      await db.challenge.update({ where: { id: c.id }, data: { flagSalt: salt, flagHash: hash } });
      rehashed += 1;
    }
    if (missing.length) throw new Error(`No flag in .flags.env for: ${missing.join(', ')}`);

    // Verify every stored hash now matches its flag under the production pepper.
    const after = await db.challenge.findMany({ select: { id: true, flagSalt: true, flagHash: true } });
    const bad = after.filter((c) => !verifyFlag(config.flagPepper, c.flagSalt, c.flagHash, flags[`FLAG_${c.id}`] ?? ''));
    if (bad.length) throw new Error(`Verification failed for ${bad.length} challenge(s) after rehash.`);

    console.log(`Rehashed ${rehashed} challenge flags into the database; all verify against the production pepper.`);
  } finally {
    await db.$disconnect();
  }
});
