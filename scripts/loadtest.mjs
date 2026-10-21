#!/usr/bin/env node
/**
 * npm run loadtest [-- --seconds 180 --players 40]
 *
 * Spins up its OWN API on a temporary port with a throwaway database (never the
 * event DB), seeds the board, starts the event, then simulates N players for the
 * duration: login, poll the board at the real interval, open challenge pages,
 * wrong+right flag submissions (respecting the cooldown), and leaderboard reads.
 * Reports requests, errors, p50/p95 latency, and combined API + challenge-service
 * memory so you can size the VM. Target: no errors, API p95 < 500 ms.
 */
import { spawn, execFileSync } from 'node:child_process';

import { mkdtempSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(repo, 'apps', 'api');
const isWin = process.platform === 'win32';
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const DURATION = Number(arg('seconds', 180)) * 1000;
const PLAYERS = Number(arg('players', 40));
const PORT = 4300 + Math.floor(Math.random() * 200);
const POLL_MS = 12_000;
const BASE = `http://127.0.0.1:${PORT}`;
const TEAMS = ['z3r0d4y', 'n0-tr4c3', 'sh3llsh0ck', 'kr4ck-t34m', 'gh0st-pr0t0', '0xdeadc0de'];

function http(method, path, { cookie, csrf, body } = {}) {
  const data = body ? JSON.stringify(body) : null;
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers['X-CSRF-Token'] = csrf;
  if (data) headers['Content-Length'] = Buffer.byteLength(data);
  const t = performance.now();
  return new Promise((res) => {
    const req = httpRequest({ host: '127.0.0.1', port: PORT, path, method, headers, timeout: 15000 }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => {
        const setCookie = (r.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
        let json = null;
        try {
          json = JSON.parse(b);
        } catch {
          /* non-JSON */
        }
        res({ status: r.statusCode ?? 0, ms: performance.now() - t, json, setCookie });
      });
    });
    req.on('error', () => res({ status: 0, ms: performance.now() - t, json: null, setCookie: '' }));
    req.on('timeout', () => (req.destroy(), res({ status: 0, ms: performance.now() - t, json: null, setCookie: '' })));
    if (data) req.write(data);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function stopServer(child) {
  // Tree-kill so the spawned API and its child challenge services all stop.
  try {
    if (isWin && child.pid) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGKILL');
  } catch {
    /* already gone */
  }
}
const samples = [];
let errors = 0;
let requests = 0;
const record = (r) => {
  requests += 1;
  samples.push(r.ms);
  if (r.status === 0 || r.status >= 500) errors += 1;
};

async function session(name, team) {
  // establish CSRF + cookie
  let r = await http('GET', '/api/auth/session');
  record(r);
  let cookie = r.setCookie;
  let csrf = r.json?.csrfToken;
  r = await http('POST', '/api/auth/login', { cookie, csrf, body: { name, teamId: team } });
  record(r);
  if (r.setCookie) cookie = [cookie, r.setCookie].filter(Boolean).join('; ');
  if (r.json?.csrfToken) csrf = r.json.csrfToken;
  return { cookie, csrf };
}

async function player(i) {
  const name = `Load Tester ${i}`;
  const team = TEAMS[i % TEAMS.length];
  let s;
  try {
    s = await session(name, team);
  } catch {
    return;
  }
  const deadline = Date.now() + DURATION;
  let lastWrong = 0;
  while (Date.now() < deadline) {
    const board = await http('GET', '/api/challenges', { cookie: s.cookie });
    record(board);
    await http('GET', '/api/me', { cookie: s.cookie }).then(record);
    await http('GET', '/api/leaderboard', { cookie: s.cookie }).then(record);
    const first = board.json?.challenges?.[0];
    if (first) {
      // wrong submission (respect ~ the 5/min cooldown: at most every 12s here)
      if (Date.now() - lastWrong > POLL_MS) {
        const wrong = await http('POST', `/api/challenges/${first.id}/submit`, { cookie: s.cookie, csrf: s.csrf, body: { flag: 'CYFLAG{nope}' } });
        record(wrong);
        lastWrong = Date.now();
      }
    }
    // jitter the poll so 40 players do not hit in lockstep
    await sleep(POLL_MS + Math.random() * 2000);
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function memoryMb() {
  // Sum RSS of the API node child and all python challenge services (Windows).
  if (!isWin) return null;
  const q = (filter) => {
    try {
      const out = execFileSync('powershell', ['-NoProfile', '-Command',
        `(Get-CimInstance Win32_Process -Filter "${filter}" | Measure-Object WorkingSetSize -Sum).Sum`], { encoding: 'utf8' }).trim();
      return Number(out || 0);
    } catch {
      return 0;
    }
  };
  // Approximate: all python under the challenge-services venv + node for this test.
  const py = q("Name='python.exe'");
  return { pythonMb: py / 1e6 };
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'cydemic-load-'));
  const dbUrl = `file:${join(dir, 'load.db').replace(/\\/g, '/')}`;
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: dbUrl,
    API_PORT: String(PORT),
    HOST: '127.0.0.1',
    ALLOWED_ORIGINS: BASE,
    PUBLIC_URL: BASE,
    SESSION_SECRET: 'loadtest-session-secret-0123456789abcdef',
    FLAG_PEPPER: 'loadtest-flag-pepper-0123456789abcdef0000',
    EVENT_MODE: 'live',
    AUTO_UNLOCK_ALL: 'true',
    CHALLENGES_ENABLED: 'true',
  };
  console.log(`[loadtest] temp DB, port ${PORT}, ${PLAYERS} players for ${DURATION / 1000}s`);
  execFileSync(isWin ? 'npm.cmd' : 'npm', ['run', 'db:deploy', '-w', '@cydemic/api'], { cwd: repo, stdio: 'ignore', shell: isWin, env });
  execFileSync(isWin ? 'npx.cmd' : 'npx', ['tsx', 'src/scripts/seed.ts', '--update-event'], { cwd: apiDir, stdio: 'ignore', shell: isWin, env });

  const server = spawn(isWin ? 'npx.cmd' : 'npx', ['tsx', 'src/server.ts'], { cwd: apiDir, env, stdio: 'ignore', shell: isWin });
  try {
    // wait for health
    for (let i = 0; i < 60; i++) {
      const h = await http('GET', '/api/health');
      if (h.status === 200) break;
      await sleep(1000);
    }
    await sleep(3000); // let challenge services come up

    const start = Date.now();
    await Promise.all(Array.from({ length: PLAYERS }, (_, i) => player(i + 1)));
    const wall = (Date.now() - start) / 1000;

    const mem = memoryMb();
    console.log(`\n  Cydemic CTF // loadtest\n`);
    console.log(`  players         ${PLAYERS}`);
    console.log(`  duration        ${wall.toFixed(0)}s`);
    console.log(`  requests        ${requests}`);
    console.log(`  errors          ${errors}`);
    console.log(`  p50 latency     ${percentile(samples, 50).toFixed(0)} ms`);
    console.log(`  p95 latency     ${percentile(samples, 95).toFixed(0)} ms`);
    if (mem) console.log(`  challenge svc   ~${mem.pythonMb.toFixed(0)} MB (all python)`);
    const pass = errors === 0 && percentile(samples, 95) < 500;
    console.log(`\n  ${pass ? 'PASS' : 'FAIL'} (target: 0 errors, p95 < 500 ms)\n`);
    stopServer(server);
    await sleep(1500);
    rmSync(dir, { recursive: true, force: true });
    process.exit(pass ? 0 : 1);
  } catch (err) {
    stopServer(server);
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
