#!/usr/bin/env node
/**
 * npm run exposure-check -- http://<ip>[:port]
 *
 * Run from ANOTHER machine on the LAN (or from the VM using its LAN address).
 * Confirms nothing sensitive is reachable on the platform port or on any
 * challenge port, and that /admin and the admin API are blocked (404) from this
 * non-allowed address. Exits non-zero if anything sensitive is reachable.
 */
import { request as httpRequest } from 'node:http';

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) {
  console.error('Usage: npm run exposure-check -- http://<ip>[:port]');
  process.exit(2);
}
const url = new URL(base);
const host = url.hostname;
const webPort = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
const CHALLENGE_PORTS = Array.from({ length: 26 }, (_, i) => 5001 + i); // 5001..5026

const SENSITIVE = [
  '/ORGANIZER-ANSWER-KEY.md',
  '/.env',
  '/.flags.env',
  '/.git/config',
  '/package.json',
  '/seed/challenges.json',
  '/seed/challenges.meta.json',
  '/apps/api/prisma/dev.db',
  '/apps/api/dev.db',
  '/dev.db',
  '/node_modules/',
  '/backups/',
  '/challenge-services/.flags.env',
  '/..%2f..%2f.env',
  '/%2e%2e/%2e%2e/.env',
];
const ADMIN_PATHS = ['/admin', '/api/admin/overview', '/api/admin/auth/session'];

function probe(port, path) {
  return new Promise((res) => {
    const req = httpRequest({ host, port, path, method: 'GET', timeout: 4000 }, (r) => {
      let body = '';
      r.on('data', (d) => (body += d.length > 2048 ? '' : d));
      r.on('end', () => res({ status: r.statusCode ?? 0, body }));
    });
    req.on('error', () => res({ status: 0, body: '' }));
    req.on('timeout', () => (req.destroy(), res({ status: 0, body: '' })));
    req.end();
  });
}

const looksSensitive = (r) => r.status === 200 && /FLAG_|SESSION_SECRET=|"dependencies"|PRIVATE KEY/i.test(r.body);

async function main() {
  const failures = [];
  let checked = 0;

  // Platform port: sensitive paths must be 404/403.
  for (const path of SENSITIVE) {
    const r = await probe(webPort, path);
    checked += 1;
    if (![403, 404].includes(r.status) || looksSensitive(r)) {
      failures.push(`platform ${path} -> HTTP ${r.status}`);
    }
  }
  // Admin must be blocked (404) from this non-allowed address.
  for (const path of ADMIN_PATHS) {
    const r = await probe(webPort, path);
    checked += 1;
    if (r.status !== 404) failures.push(`${path} reachable from this address -> HTTP ${r.status} (expected 404)`);
  }

  // Every challenge port: a service may answer "/", but the sensitive paths and
  // any directory traversal must not return file contents.
  for (const port of CHALLENGE_PORTS) {
    const root = await probe(port, '/');
    if (root.status === 0) continue; // port closed / no service - fine
    for (const path of ['/.flags.env', '/../../.env', '/%2e%2e/%2e%2e/.env', '/serve.py', '/common.py']) {
      const r = await probe(port, path);
      checked += 1;
      if (looksSensitive(r)) failures.push(`challenge :${port}${path} -> leaked content (HTTP ${r.status})`);
    }
  }

  console.log(`\n  Cydemic CTF // exposure-check  (${checked} probes against ${host})\n`);
  if (failures.length === 0) {
    console.log('  PASS - nothing sensitive is reachable, and /admin is blocked from this address.\n');
    process.exit(0);
  }
  console.log(`  FAIL - ${failures.length} problem(s):`);
  for (const f of failures) console.log(`    - ${f}`);
  console.log('');
  process.exit(1);
}

main();
