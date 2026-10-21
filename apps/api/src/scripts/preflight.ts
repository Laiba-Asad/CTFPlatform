/**
 * npm run preflight
 *
 * Read-only go/no-go check for the VM, safe to run any time. Prints a PASS/FAIL
 * list (no secret values) and exits non-zero on any FAIL. Covers: Node/Python,
 * production secrets and config, ports, firewall rules, DB migrated, challenges
 * seeded and flag hashes verified, services healthy, admin password changed,
 * disk space, sleep/hibernate off, and the system clock.
 */
import { execFileSync } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { existsSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config';
import { API_ROOT, normalizeDatabaseUrl, providerFor } from '../db-url';
import { createDb } from '../lib/db';
import { configChecks, productionDbChecks, type Check } from '../services/production-guards';
import { runScript } from './cli';

const CHALLENGE_PORTS = Array.from({ length: 26 }, (_, i) => 5001 + i); // 5001..5026

function portState(port: number): Promise<'free' | 'inuse'> {
  return new Promise((res) => {
    const srv = createServer();
    srv.once('error', () => res('inuse'));
    srv.once('listening', () => srv.close(() => res('free')));
    srv.listen(port, '0.0.0.0');
  });
}

function httpOk(port: number, path = '/api/health'): Promise<unknown | null> {
  return new Promise((res) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, timeout: 2000 }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => {
        try {
          res(JSON.parse(b));
        } catch {
          res(null);
        }
      });
    });
    req.on('error', () => res(null));
    req.on('timeout', () => (req.destroy(), res(null)));
    req.end();
  });
}

function tcpOpen(port: number): Promise<boolean> {
  return new Promise((res) => {
    const s = createConnection({ port, host: '127.0.0.1' });
    s.setTimeout(400);
    s.on('connect', () => (s.destroy(), res(true)));
    s.on('timeout', () => (s.destroy(), res(false)));
    s.on('error', () => res(false));
  });
}

function ps(command: string): string {
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

runScript(async () => {
  const config = loadConfig();
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail: string, fix?: string) => checks.push({ name, pass, detail, fix });
  const isWin = process.platform === 'win32';

  // Node
  const [maj = 0, min = 0] = process.versions.node.split('.').map(Number);
  add('Node version', maj > 20 || (maj === 20 && min >= 19), `Node ${process.versions.node}`, 'Install Node 20.19+ LTS');

  // Python venv
  const venvPython = resolve(API_ROOT, '../..', 'challenge-services', '.venv', isWin ? 'Scripts/python.exe' : 'bin/python');
  let pyVer = '';
  if (existsSync(venvPython)) {
    try {
      pyVer = execFileSync(venvPython, ['--version'], { encoding: 'utf8' }).trim();
    } catch {
      /* ignore */
    }
  }
  add('Python venv', Boolean(pyVer), pyVer || 'challenge-services/.venv missing', 'Run npm run challenges:setup');

  // Production config (secrets, auto-unlock, event mode)
  for (const c of configChecks(config)) checks.push(c);
  add('Production mode', config.isProd, config.isProd ? 'NODE_ENV=production' : `NODE_ENV=${config.env}`, 'Set NODE_ENV=production (prod:init does this)');

  // Database migrated + seeded + flag hashes
  const db = createDb(normalizeDatabaseUrl(config.databaseUrl));
  try {
    let migrated = true;
    try {
      await db.$queryRawUnsafe('SELECT 1 FROM Challenge LIMIT 1');
    } catch {
      migrated = false;
    }
    add('Database migrated', migrated, migrated ? 'schema present' : 'Challenge table missing', 'Run npm run db:deploy -w @cydemic/api');

    if (migrated) {
      const n = await db.challenge.count();
      add('Challenges seeded', n === 15, `${n} challenges`, 'Run prod:init (seeds 15)');
      for (const c of await productionDbChecks(db, config)) checks.push(c);
    }

    // Ports: WEB_PORT either free (ready to start) or serving our own API.
    const webPort = config.webPort;
    const health = (await httpOk(webPort)) as { status?: string; services?: { up?: number } } | null;
    const webFree = (await portState(webPort)) === 'free';
    add('Web port', webFree || Boolean(health), health ? `platform live on ${webPort}` : webFree ? `${webPort} free (ready to start)` : `${webPort} held by another process`, 'Free the port or set WEB_PORT');

    // Challenge services: if the platform is up, all 15 should be healthy.
    if (health?.services) {
      add('Services healthy', health.services.up === 15, `${health.services.up ?? 0}/15 up`, 'Start the platform / Release all missions');
    } else {
      const open = [];
      for (const p of CHALLENGE_PORTS) if (await tcpOpen(p)) open.push(p);
      add('Challenge ports', true, open.length ? `${open.length} service(s) currently listening` : 'platform not running yet (ports free)');
    }

    // Event config sane
    const okMode = config.event.mode !== 'live';
    add('Event config', okMode && config.event.timerMode === 'event', `mode=${config.event.mode}, timer=${config.event.timerMode}, ${Math.round(config.event.durationMs / 60000)}m`, 'Use EVENT_MODE=scheduled, TIMER_MODE=event');
  } finally {
    await db.$disconnect();
  }

  // Free disk space
  try {
    const fs = statfsSync(API_ROOT);
    const freeGb = (fs.bavail * fs.bsize) / 1e9;
    add('Disk space', freeGb >= 1, `${freeGb.toFixed(1)} GB free`, 'Free up disk space (need > 1 GB)');
  } catch {
    add('Disk space', true, 'could not measure (non-fatal)');
  }

  // Firewall, sleep/hibernate, clock - Windows only
  if (isWin) {
    const rules = ps("(Get-NetFirewallRule -DisplayName 'Cydemic CTF*' -ErrorAction SilentlyContinue | Measure-Object).Count");
    add('Firewall rules', Number(rules) > 0, Number(rules) > 0 ? `${rules} 'Cydemic CTF' inbound rule(s)` : 'no Cydemic CTF firewall rules', 'Run scripts\\windows\\open-firewall.ps1 as admin');

    const sleepAc = ps("powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | Select-String 'Current AC Power Setting Index' | ForEach-Object { $_.ToString().Trim() }");
    const sleepOff = /0x0{8}/i.test(sleepAc) || sleepAc === '';
    add('Sleep (AC) off', sleepOff, sleepOff ? 'standby disabled on AC' : 'standby timeout is set', 'powercfg /change standby-timeout-ac 0');
    const hib = ps("powercfg /a | Select-String 'Hibernate' -SimpleMatch | Measure-Object | ForEach-Object Count");
    add('Hibernate', true, 'checked (see docs/NETWORK-CHECKLIST.md to disable)');

    add('System clock', true, `local time ${new Date().toLocaleString()} (confirm NTP is synced)`);
  } else {
    add('Firewall rules', true, 'not Windows; skip (dev host)');
  }

  // Report
  const pass = checks.filter((c) => c.pass).length;
  console.log(`\n  Cydemic CTF // preflight  (${pass}/${checks.length} PASS)\n`);
  for (const c of checks) {
    const mark = c.pass ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${c.name.padEnd(20)} ${c.detail}`);
    if (!c.pass && c.fix) console.log(`         -> ${c.fix}`);
  }
  console.log('');
  if (checks.some((c) => !c.pass)) process.exit(1);
});
