#!/usr/bin/env node
/**
 * Reliable dev startup:
 *   1. check the API and web ports are free (name the process holding a busy one)
 *   2. start the API (which prepares the DB and starts the challenge supervisor)
 *   3. wait for /api/health to report ready
 *   4. start the web dev server
 * Ctrl+C stops both cleanly, leaving no stray processes.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { request as httpRequest } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function envFromDotEnv() {
  const file = join(repo, '.env');
  const out = {};
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* ignore */
    }
  }
  return out;
}
envFromDotEnv();

const API_PORT = Number(process.env.API_PORT || 4000);
const WEB_PORT = Number(process.env.WEB_PORT || 5173);
const API_HOST = '127.0.0.1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portInUse(port) {
  return new Promise((res) => {
    const socket = createConnection({ port, host: API_HOST });
    socket.setTimeout(400);
    socket.on('connect', () => (socket.destroy(), res(true)));
    socket.on('timeout', () => (socket.destroy(), res(false)));
    socket.on('error', () => res(false));
  });
}

function pidOnPort(port) {
  try {
    if (isWin) {
      const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/LISTENING\s+(\d+)\s*$/);
        if (m && line.includes(`:${port} `)) return m[1];
      }
    } else {
      return execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n')[0];
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function ensureFree(name, port) {
  if (await portInUse(port)) {
    const pid = pidOnPort(port);
    console.error(`\n[dev] Port ${port} (${name}) is already in use${pid ? ` by PID ${pid}` : ''}.`);
    console.error(`[dev] Stop that process (e.g. ${isWin ? `taskkill /PID ${pid ?? '<pid>'} /T /F` : `kill ${pid ?? '<pid>'}`}) or change ${name === 'API' ? 'API_PORT' : 'WEB_PORT'} in .env, then retry.\n`);
    process.exit(1);
  }
}

function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolveFn, rejectFn) => {
    const attempt = () => {
      const req = httpRequest({ host: API_HOST, port, path: '/api/health', timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolveFn();
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => req.destroy());
      req.end();
    };
    const retry = () => (Date.now() > deadline ? rejectFn(new Error('API did not become healthy')) : setTimeout(attempt, 400));
    attempt();
  });
}

const children = [];
function run(label, args) {
  const child = spawn(isWin ? 'npm.cmd' : 'npm', args, { cwd: repo, shell: isWin, env: process.env });
  children.push(child);
  const prefix = (buf) =>
    buf
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((l) => console.log(`[${label}] ${l}`));
  child.stdout.on('data', prefix);
  child.stderr.on('data', prefix);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[dev] ${label} exited (code ${code}). Shutting down.`);
      shutdown(1);
    }
  });
  return child;
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      if (isWin && c.pid) execFileSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else c.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  await ensureFree('API', API_PORT);
  await ensureFree('web', WEB_PORT);

  console.log('[dev] Starting API...');
  run('api', ['run', 'dev', '-w', '@cydemic/api']);
  try {
    await waitForHealth(API_PORT, 60_000);
  } catch {
    console.error('[dev] API did not report healthy within 60s. See [api] output above.');
    shutdown(1);
    return;
  }
  console.log(`[dev] API healthy on http://${API_HOST}:${API_PORT}. Starting web...`);
  run('web', ['run', 'dev', '-w', '@cydemic/web']);
  console.log(`[dev] Web starting on http://localhost:${WEB_PORT}  (open this URL)`);
}

main();
