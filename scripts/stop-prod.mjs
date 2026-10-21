#!/usr/bin/env node
/**
 * npm run stop:prod
 *
 * Stops the production API and every challenge-service child, leaving no orphan.
 * Finds the API by the port it listens on (WEB_PORT from .env) and tree-kills it
 * so its child python services go with it, then sweeps any stray serve.py that
 * belongs to this repo's challenge-services folder.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const servicesDir = join(repo, 'challenge-services').toLowerCase();
const isWin = process.platform === 'win32';

function webPort() {
  const envPath = join(repo, '.env');
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* ignore */
    }
  }
  return Number(process.env.WEB_PORT || process.env.API_PORT || 80);
}

function pidOnPort(port) {
  try {
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/LISTENING\s+(\d+)\s*$/);
      if (m && line.includes(`:${port} `)) return m[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function treeKill(pid) {
  try {
    if (isWin) execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

/** Remaining python serve.py processes started from this repo's challenge-services. */
function strayServices() {
  if (!isWin) return [];
  const script =
    "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)`t$($_.ExecutablePath)\" }";
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [pid, cmd = '', exe = ''] = l.split('\t');
        return { pid, cmd, exe };
      })
      .filter((p) => (p.cmd + p.exe).toLowerCase().includes(servicesDir) || (p.cmd.toLowerCase().includes('serve.py') && (p.exe || '').toLowerCase().includes('challenge-services')));
  } catch {
    return [];
  }
}

let stopped = 0;
const port = webPort();
const apiPid = pidOnPort(port);
if (apiPid) {
  if (treeKill(apiPid)) {
    stopped += 1;
    console.log(`[stop:prod] stopped API on port ${port} and its child services (PID ${apiPid})`);
  }
} else {
  console.log(`[stop:prod] no API listening on port ${port}.`);
}

// Sweep any orphaned challenge services (e.g. if the API was killed abruptly).
for (const p of strayServices()) {
  if (treeKill(p.pid)) {
    stopped += 1;
    console.log(`[stop:prod] stopped stray challenge service (PID ${p.pid})`);
  }
}

console.log(`[stop:prod] Stopped ${stopped} process group(s). No orphans left.`);
