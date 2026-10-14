#!/usr/bin/env node
/** Run a script inside the challenge-services virtualenv. Usage: node scripts/run-python.mjs <script.py> [args...] */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svc = join(repo, 'challenge-services');
const py = process.platform === 'win32'
  ? join(svc, '.venv', 'Scripts', 'python.exe')
  : join(svc, '.venv', 'bin', 'python');

if (!existsSync(py)) {
  console.error('challenge-services venv not found. Run: npm run challenges:setup');
  process.exit(1);
}
const [script, ...args] = process.argv.slice(2);
execFileSync(py, [script, ...args], { cwd: svc, stdio: 'inherit' });
