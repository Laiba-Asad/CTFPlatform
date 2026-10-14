/**
 * Prepare the E2E run BEFORE Playwright starts (Playwright launches the web
 * server during global setup, so DB prep must happen earlier to avoid racing
 * the server on the SQLite file). Frees the port, rebuilds a clean database and
 * builds the web app the API serves. Never touches dev.db.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_PORT, serverEnv } from './env';

const here = fileURLToPath(new URL('.', import.meta.url));
const webDir = resolve(here, '..');
const apiDir = resolve(here, '../../api');
const env = { ...process.env, ...serverEnv };
const run = (cmd: string, cwd: string) => execSync(cmd, { cwd, env, stdio: 'inherit' });

// Free the port if a previous run left the server listening (holds the DB lock).
try {
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${API_PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
  } else {
    execSync(`fuser -k ${API_PORT}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
  }
} catch {
  /* nothing was listening */
}

// Fresh database and a web build for the API to serve.
execSync(process.platform === 'win32' ? 'cmd /c "del /q e2e.db e2e.db-shm e2e.db-wal 2>nul & exit 0"' : 'rm -f e2e.db e2e.db-shm e2e.db-wal', { cwd: apiDir, env });
run('npx prisma migrate deploy', apiDir);
run('npx tsx src/scripts/e2e-seed.ts', apiDir);
run('npx vite build', webDir);

console.log('E2E preparation complete.');
