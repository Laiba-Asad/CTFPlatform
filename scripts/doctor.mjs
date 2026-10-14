#!/usr/bin/env node
/**
 * npm run doctor - prints the platform health as a short table. Reads the live
 * /api/health endpoint (DB status, event state, released challenges, per-service
 * up/down). No flag values. Works whether or not the API is running.
 */
import { existsSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(repo, '.env'))) {
  try {
    process.loadEnvFile(join(repo, '.env'));
  } catch {
    /* ignore */
  }
}
const port = Number(process.env.API_PORT || 4000);

function fetchHealth() {
  return new Promise((res, rej) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: '/api/health', timeout: 2500 }, (r) => {
      let body = '';
      r.on('data', (d) => (body += d));
      r.on('end', () => {
        try {
          res(JSON.parse(body));
        } catch {
          rej(new Error('bad response'));
        }
      });
    });
    req.on('error', rej);
    req.on('timeout', () => (req.destroy(), rej(new Error('timeout'))));
    req.end();
  });
}

const row = (k, v) => console.log('  ' + k.padEnd(20) + v);

try {
  const h = await fetchHealth();
  console.log('\n  Cydemic CTF // health\n');
  row('API', `up (uptime ${h.uptime}s)`);
  row('Database', h.database);
  if (h.event) {
    row('Event mode', h.event.mode);
    row('Event phase', h.event.phase);
    row('Event window', `${h.event.startsAt}  ->  ${h.event.endsAt}`);
  } else {
    row('Event', 'not configured');
  }
  row('Challenges', `${h.challenges.released} released of ${h.challenges.total}`);
  if (h.services.supervising) {
    row('Services', `${h.services.up} up, ${h.services.starting} starting, ${h.services.down} down`);
    const bad = h.services.detail.filter((s) => s.status !== 'up');
    if (bad.length) row('  needs attention', bad.map((s) => `${s.id}:${s.status}`).join(', '));
  } else {
    row('Services', 'supervisor not running (CHALLENGES_ENABLED=false or no venv/.flags.env)');
  }
  console.log('');
  process.exit(h.status === 'ok' ? 0 : 2);
} catch {
  console.error(`\n  API not reachable on http://127.0.0.1:${port}. Is it running? (npm run dev)\n`);
  process.exit(1);
}
