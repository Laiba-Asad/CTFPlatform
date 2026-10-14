#!/usr/bin/env node
/**
 * Build-failing static checks for the CTF platform:
 *  1. No literal `flag{` in any tracked source file (real flags live only in
 *     the git-ignored .flags.env).
 *  2. No debug=True / use_debugger / use_reloader=True in challenge-services.
 *  3. No command-execution APIs in challenge-services/web08.py.
 *  4. No http(s):// asset URLs in the web app source or the challenge templates
 *     (the LAN may be offline; everything must be self-hosted).
 *  5. Nothing secret or generated is tracked by git (*.pyc, *.db, .flags.env,
 *     challenge-services/generated|runtime). Skipped if not a git repo.
 *  6. Every admin API route is guarded: the admin router is composed behind
 *     requireAdminAuth, app.ts mounts it behind the subnet + session guards,
 *     and every mutating admin route (post/put/patch/delete) requires the full
 *     admin role (viewers are read-only).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const problems = [];
const add = (msg) => problems.push(msg);

const IGNORE_DIRS = new Set(['node_modules', '.git', '.venv', 'dist', 'coverage', 'generated', 'runtime', 'generatedprisma']);
const SKIP_NAMES = new Set(['.flags.env', '.flags.env.example', 'check-security-static.mjs', 'package-lock.json']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') && name !== '.gitignore' && name !== '.env.example' && name !== '.dockerignore') {
      // allow dotfiles we care about, skip .venv/.git handled below
    }
    const path = join(dir, name);
    const rel = relative(repo, path);
    if (statSync(path).isDirectory()) {
      if (!IGNORE_DIRS.has(name) && !rel.includes('src\\generated') && !rel.includes('src/generated')) yield* walk(path);
    } else {
      yield path;
    }
  }
}

const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|py|json|html|css|md|prisma|txt|env|example|yml|yaml|toml|bat|sh)$/i;

// 1. flag{ anywhere in tracked text files
for (const file of walk(repo)) {
  const name = file.split(/[\\/]/).pop();
  if (SKIP_NAMES.has(name) || !TEXT_EXT.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('flag{')) add(`flag{ literal in ${relative(repo, file)}`);
}

// 2 & 3. challenge-services Python checks
const svc = join(repo, 'challenge-services');
const debugRe = /debug\s*=\s*True|use_reloader\s*=\s*True|use_debugger\s*=\s*True/;
const cmdRe = /\bimport\s+subprocess\b|\bsubprocess\.\w|\bos\.(system|popen|exec\w*|spawn\w*)\s*\(|\bpty\./;
for (const file of walk(svc)) {
  if (!file.endsWith('.py')) continue;
  const name = file.split(/[\\/]/).pop();
  if (name.startsWith('test_')) continue;
  const text = readFileSync(file, 'utf8');
  if (debugRe.test(text)) add(`debugger/reloader enabled in ${relative(repo, file)}`);
  if (name === 'web08.py' && cmdRe.test(text)) add(`command-execution API in ${relative(repo, file)}`);
}

// 4. external asset URLs in web source and challenge templates
const urlRe = /https?:\/\//;
const webSrc = join(repo, 'apps', 'web', 'src');
const templates = join(svc, 'templates');
for (const base of [webSrc, templates]) {
  for (const file of walk(base)) {
    if (!/\.(ts|tsx|css|html)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (urlRe.test(text)) add(`external URL in ${relative(repo, file)} (self-host for offline LAN)`);
  }
}

// 5. git-tracked secrets/artifacts
try {
  const tracked = execFileSync('git', ['ls-files'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/);
  const bad = tracked.filter((f) =>
    /\.pyc$/.test(f) || /\.db$/.test(f) || f.endsWith('.flags.env') ||
    f.startsWith('challenge-services/generated/') || f.startsWith('challenge-services/runtime/'),
  );
  for (const f of bad) add(`secret/generated file tracked by git: ${f}`);
} catch {
  // not a git repo yet; nothing to check
}

// 6. admin route guards
const adminDir = join(repo, 'apps', 'api', 'src', 'routes', 'admin');
try {
  // 6a. The composition root applies requireAdminAuth to everything.
  const indexSrc = readFileSync(join(adminDir, 'index.ts'), 'utf8');
  if (!/router\.use\(\s*requireAdminAuth\s*\)/.test(indexSrc)) {
    add('apps/api/src/routes/admin/index.ts does not apply requireAdminAuth to the admin router');
  }

  // 6b. Every mutating route in the admin router requires the admin role.
  for (const file of walk(adminDir)) {
    if (!file.endsWith('.ts') || file.endsWith('index.ts')) continue;
    const src = readFileSync(file, 'utf8');
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = /\brouter\.(post|put|patch|delete)\(/.exec(line);
      if (m && !line.includes('requireAdminRole')) {
        add(`unguarded admin mutation (${m[1].toUpperCase()}) at ${relative(repo, file)}:${i + 1} — add requireAdminRole`);
      }
    });
  }

  // 6c. app.ts mounts the admin API behind the subnet guard and session loader.
  const appSrc = readFileSync(join(repo, 'apps', 'api', 'src', 'app.ts'), 'utf8');
  for (const needle of ['adminSubnetGuard(config)', 'loadAdminSession(db, config)', "csrfProtection(config, 'admin')"]) {
    if (!appSrc.includes(needle)) add(`app.ts is missing the admin guard: ${needle}`);
  }
} catch (err) {
  add(`admin route guard check could not run: ${err.message}`);
}

if (problems.length) {
  console.error('Security static checks failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Security static checks passed.');
