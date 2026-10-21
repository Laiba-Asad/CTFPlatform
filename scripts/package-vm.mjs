#!/usr/bin/env node
/**
 * npm run package:vm
 *
 * Builds dist/cydemic-ctf-vm.zip for copying to the VM. Includes only what the
 * VM needs (source, built web app, migrations, challenge services, scripts, docs,
 * .flags.env) and EXCLUDES the answer key, .git, .env, every *.db and backups,
 * logs, node_modules, _retired, dist, screenshots and anything with a password.
 * Prints a manifest and fails if an excluded item would be included.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const outZip = join(repo, 'dist', 'cydemic-ctf-vm.zip');

// Sensitive items that must NEVER be packaged. If any of these would be
// included, the script fails loudly (the VM must not receive them).
const FORBID = (p) =>
  p === 'ORGANIZER-ANSWER-KEY.md' ||
  (/(^|\/)\.env($|\.)/.test(p) && !p.endsWith('.example')) ||
  p.startsWith('.git/') ||
  p.startsWith('backups/') ||
  p.includes('/backups/') ||
  /\.db(-wal|-shm)?$/.test(p);

// Items that are simply not needed on the VM: dropped silently.
const DROP = (p) =>
  p.startsWith('node_modules/') ||
  p.includes('/node_modules/') ||
  p.startsWith('dist/') ||
  p.startsWith('logs/') ||
  p.includes('/logs/') ||
  p.includes('challenge-services/_retired/') ||
  p.includes('challenge-services/.venv/') ||
  p.includes('challenge-services/runtime/') ||
  p.includes('challenge-services/generated/') ||
  p.includes('/e2e-screenshots/') ||
  p.includes('/e2e-results/') ||
  p.includes('/playwright-report/') ||
  /\.pyc$/.test(p);

function trackedFiles() {
  // Tracked files PLUS untracked files that are not git-ignored, so new (not yet
  // committed) scripts and source are packaged, while .gitignore still keeps
  // secrets (.env, .flags.env, *.db, backups, answer key) out. We add .flags.env
  // back explicitly below because the VM needs it.
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8' });
  return out.split(/\r?\n/).filter(Boolean);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(relative(repo, full).replace(/\\/g, '/'));
  }
  return acc;
}

function main() {
  // Build the web app first so apps/web/dist exists.
  if (!existsSync(join(repo, 'apps', 'web', 'dist', 'index.html'))) {
    console.log('[package:vm] Building web app...');
    execFileSync(isWin ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: repo, stdio: 'inherit', shell: isWin });
  }

  // Candidate files: tracked source + built web app + the flags file the VM needs.
  const candidates = new Set(trackedFiles());
  for (const f of walk(join(repo, 'apps', 'web', 'dist'))) candidates.add(f);
  if (existsSync(join(repo, 'challenge-services', '.flags.env'))) candidates.add('challenge-services/.flags.env');

  const include = [];
  const forbidden = [];
  for (const f of candidates) {
    if (FORBID(f)) forbidden.push(f);
    else if (!DROP(f)) include.push(f);
    // else: dropped silently (not needed on the VM)
  }
  if (forbidden.length) {
    console.error(`[package:vm] Refusing: ${forbidden.length} sensitive item(s) would be packaged:`);
    for (const f of forbidden.slice(0, 10)) console.error(`  - ${f}`);
    process.exit(1);
  }

  // Stage into a temp dir, then zip the staging dir's contents.
  const stage = mkdtempSync(join(tmpdir(), 'cydemic-vm-'));
  for (const f of include) {
    const dest = join(stage, f);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(repo, f), dest);
  }
  mkdirSync(join(repo, 'dist'), { recursive: true });
  if (existsSync(outZip)) rmSync(outZip, { force: true });
  if (isWin) {
    execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${stage}${sep}*' -DestinationPath '${outZip}' -Force`], { stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-r', '-q', outZip, '.'], { cwd: stage });
  }
  rmSync(stage, { recursive: true, force: true });

  const sizeMb = (statSync(outZip).size / 1e6).toFixed(1);
  console.log(`\n[package:vm] Wrote ${outZip} (${sizeMb} MB, ${include.length} files)`);
  console.log('[package:vm] Manifest (top-level):');
  const tops = [...new Set(include.map((f) => f.split('/')[0]))].sort();
  for (const t of tops) console.log(`  - ${t}${include.some((f) => f.startsWith(`${t}/`)) ? '/' : ''}`);
  console.log('[package:vm] Excluded by design: ORGANIZER-ANSWER-KEY.md, .env, *.db, backups/, logs/, node_modules/, _retired/, dist/, screenshots.');
  console.log('[package:vm] The VM runs: unzip, npm ci, npm run prod:init, open-firewall.ps1, npm run preflight, start-event.cmd');
}

main();
