/**
 * Browser solve tests for the browser-only challenges. Each one launches the
 * real Python service with a synthetic test flag (never a real flag) and drives
 * a Chromium page through the exact DevTools action a player would use.
 *
 * Skips automatically unless the challenge-services venv and .flags.env exist
 * (the same gate the supervisor integration test uses).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const services = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../challenge-services');
const venvPython = join(services, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const ready = existsSync(join(services, '.flags.env')) && existsSync(venvPython);

// A synthetic test value (not the real flag format, not a real flag).
const testFlag = (cid: string) => `CYTEST-${cid}-${Math.random().toString(36).slice(2, 8)}`;

const running: ChildProcess[] = [];

async function freePort(): Promise<number> {
  const { createServer } = await import('node:net');
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => res(p));
    });
    s.on('error', rej);
  });
}

function waitHttp(port: number, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((res, rej) => {
    const tick = () => {
      const s = createConnection({ port, host: '127.0.0.1' });
      s.setTimeout(500);
      s.on('connect', () => (s.destroy(), res()));
      s.on('timeout', () => (s.destroy(), Date.now() > deadline ? rej(new Error('timeout')) : setTimeout(tick, 150)));
      s.on('error', () => (Date.now() > deadline ? rej(new Error('down')) : setTimeout(tick, 150)));
    };
    tick();
  });
}

/** Launch one challenge service with a fresh flag; returns its base URL + flag. */
async function launch(cid: string, extraEnv: Record<string, string> = {}) {
  const port = await freePort();
  const flag = testFlag(cid);
  const child = spawn(venvPython, ['serve.py'], {
    cwd: services,
    env: { ...process.env, CHALLENGE_ID: cid, CHALLENGE_FLAG: flag, PORT: String(port), ...extraEnv },
    stdio: 'ignore',
    windowsHide: true,
  });
  running.push(child);
  await waitHttp(port);
  return { url: `http://127.0.0.1:${port}`, flag };
}

test.afterAll(() => {
  for (const c of running) c.kill();
});

test.skip(!ready, 'challenge-services venv and .flags.env required');
test.describe.configure({ mode: 'parallel' });

test('web19 Invisible Ink: Select All reveals the hidden text', async ({ page }) => {
  const { url, flag } = await launch('web19');
  await page.goto(url);
  // Nothing visible at a glance, but the text is selectable and in the DOM.
  await expect(page.locator('body')).toContainText(flag);
});

test('web20 Locked Button: enable the disabled button, then claim', async ({ page }) => {
  const { url, flag } = await launch('web20');
  await page.goto(url);
  const button = page.getByRole('button', { name: 'Claim' });
  await expect(button).toBeDisabled();
  await expect(page.locator('body')).not.toContainText(flag);
  await button.evaluate((el) => el.removeAttribute('disabled')); // DevTools Elements
  await button.click();
  await expect(page.locator('body')).toContainText(flag);
});

test('web21 Storage Locker: the note lands in localStorage', async ({ page }) => {
  const { url, flag } = await launch('web21');
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('saved');
  const note = await page.evaluate(() => localStorage.getItem('note_to_self'));
  expect(note).toContain(flag);
  await expect(page.locator('body')).not.toContainText(flag);
});

test('web22 Console Whisper: calling whisper() prints the flag', async ({ page }) => {
  const { url, flag } = await launch('web22');
  await page.goto(url);
  const result = await page.evaluate(() => (window as unknown as { whisper: () => Promise<string> }).whisper());
  expect(result).toContain(flag);
  await expect(page.locator('body')).not.toContainText(flag);
});

test('web23 Gatekeeper: the password is in the readable script', async ({ page }) => {
  const { url, flag } = await launch('web23', { CHALLENGE_SECRET_PASSWORD: 'river-copper-lantern42' });
  await page.goto(url);
  const script = await (await page.request.get(`${url}/assets/gate.js`)).text();
  const pieces = JSON.parse(/var pieces = (\[[^\]]*\]);/.exec(script)![1]) as string[];
  await page.getByLabel('Staff password').fill(pieces.join(''));
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('#result')).toContainText(flag);
});

test('web24 Badge Check: editing the cookie to staff shows the flag', async ({ page, context }) => {
  const { url, flag } = await launch('web24');
  await page.goto(url);
  await expect(page.locator('body')).not.toContainText(flag);
  await context.addCookies([{ name: 'badge_level', value: 'staff', url }]);
  await page.reload();
  await expect(page.locator('body')).toContainText(flag);
});

test('web25 Guest List: editing the ticket number reaches ticket 1000', async ({ page }) => {
  const { url, flag } = await launch('web25');
  await page.goto(`${url}/ticket/1042`);
  await expect(page.locator('body')).not.toContainText(flag);
  await page.goto(`${url}/ticket/1000`);
  await expect(page.locator('body')).toContainText(flag);
});

test('net5 Plain Text: filter, follow the login stream, read the flag', async ({ page }) => {
  const { url, flag } = await launch('net5');
  await page.goto(url);
  await expect(page.locator('tr.packet').first()).toBeVisible();
  // The flag is not in the served HTML or the viewer script (only in stream hex).
  expect(await (await page.request.get(url)).text()).not.toContain(flag);
  expect(await (await page.request.get(`${url}/assets/viewer.js`)).text()).not.toContain(flag);
  // Filter narrows the table; then open a packet and follow its stream.
  await page.getByLabel('Filter').fill('login');
  const row = page.locator('tr.packet').first();
  await expect(row).toBeVisible();
  await row.click();
  await page.getByRole('button', { name: 'Follow stream' }).click();
  await expect(page.locator('#d-payload')).toContainText(flag);
});
