#!/usr/bin/env node
/**
 * npm run start - build the web app and serve everything from the API on one
 * port, so LAN players use a single address. Port is configurable with
 * SERVE_PORT (default 8080). Applies DB migrations first.
 */
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(repo, 'apps', 'api');
const isWin = process.platform === 'win32';
const port = process.env.SERVE_PORT || '8080';

console.log('[start] Building web + API...');
execFileSync(isWin ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: repo, stdio: 'inherit', shell: isWin });

console.log(`[start] Serving on http://0.0.0.0:${port} (SERVE_WEB)`);
const env = { ...process.env, SERVE_WEB: 'true', API_PORT: port, HOST: process.env.HOST || '0.0.0.0' };
// `npm run start -w @cydemic/api` runs prisma migrate deploy then node dist/server.js.
const child = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'start', '-w', '@cydemic/api'], {
  cwd: repo,
  stdio: 'inherit',
  shell: isWin,
  env,
});
void apiDir;
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
