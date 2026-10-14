#!/usr/bin/env node
/**
 * Create the Python virtual environment for challenge-services and install
 * pinned requirements. Works on Windows (py launcher) and POSIX (python3).
 *
 *   npm run challenges:setup
 *
 * Picks the newest available Python >= 3.11 (Flask 3 needs it).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svc = join(repo, 'challenge-services');
const isWin = process.platform === 'win32';
const venv = join(svc, '.venv');
const venvPython = isWin ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python');

function tryVersion(cmd, args) {
  try {
    const out = execFileSync(cmd, [...args, '-c', 'import sys;print("%d.%d"%sys.version_info[:2])'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const [maj, min] = out.split('.').map(Number);
    return maj === 3 && min >= 11 ? { cmd, args, version: out } : null;
  } catch {
    return null;
  }
}

function findPython() {
  const candidates = isWin
    ? [['py', ['-3.13']], ['py', ['-3.12']], ['py', ['-3.11']], ['python', []], ['py', ['-3']]]
    : [['python3.13', []], ['python3.12', []], ['python3.11', []], ['python3', []]];
  for (const [cmd, args] of candidates) {
    const found = tryVersion(cmd, args);
    if (found) return found;
  }
  throw new Error('No Python >= 3.11 found. Install Python 3.12+ and retry.');
}

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: svc, stdio: 'inherit' });
}

if (!existsSync(venvPython)) {
  const py = findPython();
  console.log(`Using Python ${py.version}`);
  run(py.cmd, [...py.args, '-m', 'venv', '.venv']);
}
run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet']);
run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt', '--quiet']);
console.log('challenge-services environment ready.');
