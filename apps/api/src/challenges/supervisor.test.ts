import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RETIRED_CHALLENGE_IDS } from './retired';
import { ChallengeSupervisor } from './supervisor';
import { API_ROOT } from '../db-url';
import { createLogger } from '../lib/logger';
import { testConfig, testDb } from '../test-utils';

const SERVICES = resolve(API_ROOT, '../..', 'challenge-services');
const venvPython = join(SERVICES, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const ready = existsSync(join(SERVICES, '.flags.env')) && existsSync(venvPython);

// Integration test: spawns real Python services. Skipped until the venv and
// .flags.env exist (npm run challenges:setup && build_flags_env.py).
const d = ready ? describe : describe.skip;

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

function get(port: number, path = '/'): Promise<number> {
  return new Promise((res) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, timeout: 1500 }, (r) => {
      r.resume();
      res(r.statusCode ?? 0);
    });
    req.on('error', () => res(0));
    req.on('timeout', () => (req.destroy(), res(0)));
    req.end();
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

d('ChallengeSupervisor (integration)', () => {
  let sup: ChallengeSupervisor;

  afterEach(async () => {
    await sup?.stopAll();
  });

  it('starts a service, serves it, then stops it leaving the port free', async () => {
    sup = new ChallengeSupervisor(testDb(), testConfig(), createLogger(testConfig()));
    expect(sup.available).toBe(true);
    const port = await freePort();

    await sup.start('web1', port);
    expect(sup.isRunning('web1')).toBe(true);
    expect(await get(port)).toBe(200);

    await sup.stop('web1');
    expect(sup.isRunning('web1')).toBe(false);
    await sleep(500);
    expect(await get(port)).toBe(0);
  }, 30_000);

  it('restarts a crashed service', async () => {
    sup = new ChallengeSupervisor(testDb(), testConfig(), createLogger(testConfig()));
    const port = await freePort();
    await sup.start('web2', port);
    const firstPid = sup.pid('web2');
    expect(firstPid).toBeGreaterThan(0);

    process.kill(firstPid!); // simulate a crash
    // Wait for the supervisor to notice and relaunch.
    for (let i = 0; i < 40 && (!sup.isRunning('web2') || sup.pid('web2') === firstPid); i++) await sleep(250);
    expect(sup.isRunning('web2')).toBe(true);
    expect(sup.pid('web2')).not.toBe(firstPid);
    let status = 0;
    for (let i = 0; i < 40 && status !== 200; i++) {
      status = await get(port);
      if (status !== 200) await sleep(250);
    }
    expect(status).toBe(200);
  }, 30_000);

  it('runs the net5 HTTP service (Capture Viewer) and frees its port on stop', async () => {
    sup = new ChallengeSupervisor(testDb(), testConfig(), createLogger(testConfig()));
    const port = await freePort();
    await sup.start('net5', port);
    expect(sup.isRunning('net5')).toBe(true);
    expect(await get(port)).toBe(200);
    await sup.stop('net5');
    await sleep(500);
    expect(await get(port)).toBe(0);
  }, 30_000);

  it('never starts a retired challenge', async () => {
    sup = new ChallengeSupervisor(testDb(), testConfig(), createLogger(testConfig()));
    const port = await freePort();
    for (const cid of RETIRED_CHALLENGE_IDS) {
      await sup.start(cid, port);
      expect(sup.isRunning(cid)).toBe(false);
    }
    expect(await get(port)).toBe(0);
  }, 30_000);

  it('stopAll leaves no child processes', async () => {
    sup = new ChallengeSupervisor(testDb(), testConfig(), createLogger(testConfig()));
    const [p1, p2] = [await freePort(), await freePort()];
    await sup.start('web1', p1);
    await sup.start('web2', p2);
    const pids = [sup.pid('web1'), sup.pid('web2')].filter(Boolean) as number[];
    expect(pids).toHaveLength(2);

    await sup.stopAll();
    expect(sup.runningIds()).toEqual([]);
    await sleep(500);
    for (const pid of pids) {
      expect(() => process.kill(pid, 0)).toThrow(); // no such process
    }
  }, 30_000);
});
