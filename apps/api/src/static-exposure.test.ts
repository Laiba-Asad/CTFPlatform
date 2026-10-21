import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { testConfig, testDb } from './test-utils';

/**
 * Production single-URL deploy: the API serves the built web app. Nothing
 * outside apps/web/dist may be reachable, and /admin is hidden from non-allowed
 * addresses. We build a tiny fake dist, then probe the sensitive paths.
 */
describe('production static serving', () => {
  let dir: string;
  let dist: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cydemic-dist-'));
    dist = join(dir, 'web', 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Cydemic</title><div id=root></div>');
    writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log("app")');
    // A decoy dotfile physically inside dist must still never be served.
    writeFileSync(join(dist, '.env'), 'SECRET=should-never-be-served');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const prodApp = () => {
    // TRUST_PROXY=1 so X-Forwarded-For drives req.ip in these tests.
    const config = testConfig({ NODE_ENV: 'production', SERVE_WEB: 'true', TRUST_PROXY: '1', SESSION_SECRET: 'x'.repeat(40), FLAG_PEPPER: 'y'.repeat(40) });
    const app = createApp(config, { db: testDb(), webDist: dist });
    return { app };
  };

  const SENSITIVE = [
    '/ORGANIZER-ANSWER-KEY.md',
    '/.env',
    '/.flags.env',
    '/.git/config',
    '/package.json',
    '/seed/challenges.json',
    '/apps/api/prisma/dev.db',
    '/apps/api/dev.db',
    '/node_modules/',
    '/node_modules/left-pad/index.js',
    '/backups/',
    '/backups/ctf.db',
    '/challenge-services/.flags.env',
    '/dev.db',
    // path-traversal variants
    '/..%2f..%2f.env',
    '/..%2f..%2f..%2fpackage.json',
    '/%2e%2e/%2e%2e/.env',
    '/static/../../../.env',
  ];

  it('returns 404 or 403 for every sensitive path', async () => {
    const { app } = prodApp();
    for (const path of SENSITIVE) {
      const res = await request(app).get(path);
      expect([403, 404], `${path} should be blocked, got ${res.status}`).toContain(res.status);
      expect(res.text ?? '').not.toContain('should-never-be-served');
      expect(res.text ?? '').not.toMatch(/"dependencies"|FLAG_|SESSION_SECRET=/);
    }
  });

  it('serves the SPA shell and real assets', async () => {
    const { app } = prodApp();
    const shell = await request(app).get('/missions'); // client route
    expect(shell.status).toBe(200);
    expect(shell.text).toContain('id=root');
    const asset = await request(app).get('/assets/app-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.text).toContain('console.log');
  });

  it('hides /admin from a non-allowed address (404), allows it from localhost', async () => {
    const { app } = prodApp();
    const blocked = await request(app).get('/admin').set('X-Forwarded-For', '10.1.2.3');
    expect(blocked.status).toBe(404);
    // localhost (default allow) gets the SPA shell so the organizer sees the login
    const allowed = await request(app).get('/admin');
    expect(allowed.status).toBe(200);
    expect(allowed.text).toContain('id=root');
  });

  it('does not emit source maps for served assets', async () => {
    const { app } = prodApp();
    const res = await request(app).get('/assets/app-abc123.js.map');
    expect([403, 404]).toContain(res.status);
  });
});
