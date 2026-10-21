#!/usr/bin/env node
/**
 * npm run start:prod
 *
 * Production start on the VM: builds the web app + API, checks the port is free,
 * then runs the API with NODE_ENV=production and SERVE_WEB so players use one URL.
 * The server itself refuses to start on any unsafe config (see production-guards).
 *
 * Port comes from WEB_PORT in .env (default 80). If it is busy, this names the
 * process holding it and tells you how to use 8080 instead - never a silent fallback.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectLanIp, portBindable } from './lib/net.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function loadEnv() {
  const envPath = join(repo, '.env');
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* ignore */
    }
  }
}

/** Which PID holds a TCP port (Windows), for a helpful message. */
function pidOnPort(port) {
  try {
    if (isWin) {
      const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/LISTENING\s+(\d+)\s*$/);
        if (m && line.includes(`:${port} `)) {
          let name = '';
          try {
            name = execFileSync('tasklist', ['/FI', `PID eq ${m[1]}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split(',')[0].replace(/"/g, '');
          } catch {
            /* ignore */
          }
          return { pid: m[1], name };
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function main() {
  loadEnv();
  if (process.env.NODE_ENV !== 'production') process.env.NODE_ENV = 'production';
  const port = Number(process.env.WEB_PORT || 80);

  if (!(await portBindable(port))) {
    const holder = pidOnPort(port);
    console.error(`\n[start:prod] Port ${port} is already in use${holder ? ` by ${holder.name || 'a process'} (PID ${holder.pid})` : ''}.`);
    if (port === 80) {
      console.error('[start:prod] Port 80 is commonly taken by a Windows system service (http.sys / "System", PID 4),');
      console.error('[start:prod] which cannot simply be stopped. Use port 8080 instead:');
      console.error('[start:prod]   set WEB_PORT=8080 in .env (or run: npm run prod:init -- --port 8080 --force), then retry.');
    } else {
      console.error(`[start:prod] Free the port (stop that process) or set a different WEB_PORT in .env, then retry.`);
    }
    process.exit(1);
  }

  console.log('[start:prod] Building web + API...');
  execFileSync(isWin ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: repo, stdio: 'inherit', shell: isWin });

  const ip = detectLanIp();
  const url = `http://${ip}${port === 80 ? '' : `:${port}`}`;
  console.log(`\n[start:prod] Starting production server.`);
  console.log(`[start:prod] Players open:  ${url}`);
  console.log(`[start:prod] Admin on the VM: ${url}/admin\n`);

  const env = { ...process.env, SERVE_WEB: 'true', API_PORT: String(port), HOST: process.env.HOST || '0.0.0.0', NODE_ENV: 'production' };
  // `npm run start -w @cydemic/api` = prisma migrate deploy && node dist/server.js
  const child = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'start', '-w', '@cydemic/api'], { cwd: repo, stdio: 'inherit', shell: isWin, env });
  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
