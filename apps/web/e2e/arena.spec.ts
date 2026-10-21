import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ADMIN_PASS, ADMIN_USER, BASE_URL } from './env';

const FLAG = 'CYFLAG{e2e-demo-flag}';
const SHOT = (name: string) => ({ path: `e2e-screenshots/${name}.png`, fullPage: true });

// The event is a global singleton, so these journeys run in order.
test.describe.configure({ mode: 'serial' });

/** A fresh browser context pinned to the E2E origin (pages + request share baseURL). */
const newCtx = (browser: Browser) => browser.newContext({ baseURL: BASE_URL });

async function adminSignIn(page: Page, user = ADMIN_USER, pass = ADMIN_PASS) {
  await page.goto('/admin');
  await page.getByLabel('Username').fill(user);
  await page.getByLabel('Password').fill(pass);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

async function gotoAdmin(page: Page, nav: string) {
  await page.getByRole('link', { name: nav, exact: true }).click();
}

async function joinPlayer(context: BrowserContext, name: string, teamName: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: teamName, exact: true }).click();
  await page.getByRole('button', { name: /enter the arena/i }).click();
  return page;
}

/** Parse the top-bar timer "HH:MM:SS" into seconds. */
async function timerSeconds(page: Page): Promise<number> {
  const label = (await page.getByRole('timer').getAttribute('aria-label')) ?? '';
  const m = label.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (!m) throw new Error(`no timer in "${label}"`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

test('admin signs in (wrong password handled); a player cannot reach admin', async ({ page, browser }) => {
  // Wrong password shows a specific message.
  await page.goto('/admin');
  await page.getByLabel('Username').fill(ADMIN_USER);
  await page.getByLabel('Password').fill('nope');
  await page.screenshot(SHOT('01-admin-login'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Wrong username or password.')).toBeVisible();

  // Correct credentials land on the Overview.
  await page.getByLabel('Password').fill(ADMIN_PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  // Empty leaderboard (captured before anyone joins — the only truly empty moment).
  await gotoAdmin(page, 'Leaderboard');
  await expect(page.getByText('No players yet.')).toBeVisible();
  await page.screenshot(SHOT('04-empty-leaderboard'));

  // Event page (waiting) screenshot.
  await gotoAdmin(page, 'Event');
  await expect(page.getByText('Waiting to start')).toBeVisible();
  await page.screenshot(SHOT('02-event-admin-waiting'));

  // A player session cannot reach the admin API or UI.
  const playerCtx = await newCtx(browser);
  const player = await joinPlayer(playerCtx, 'Guard Tester', 'Z3R0D4Y');
  expect((await playerCtx.request.get('/api/admin/overview')).status()).toBe(401);
  await player.goto('/admin');
  await expect(player.getByRole('heading', { name: 'Organizer sign in' })).toBeVisible();
  await playerCtx.close();
});

test('players wait, then all flip to live together when the organizer starts', async ({ browser }) => {
  const admin = await newCtx(browser);
  const adminPage = await admin.newPage();
  await adminSignIn(adminPage);

  const ctxA = await newCtx(browser);
  const ctxB = await newCtx(browser);
  const a = await joinPlayer(ctxA, 'Alice Arena', 'Z3R0D4Y');
  const b = await joinPlayer(ctxB, 'Bob Arena', 'N0_TR4C3');

  // Both see the waiting screen.
  await expect(a.getByRole('heading', { name: 'Waiting to start' })).toBeVisible();
  await expect(b.getByRole('heading', { name: 'Waiting to start' })).toBeVisible();
  await a.screenshot(SHOT('03-waiting-screen'));

  // Start the shared clock.
  await gotoAdmin(adminPage, 'Event');
  await adminPage.getByRole('button', { name: 'Start event now' }).click();
  await adminPage.getByRole('button', { name: 'Start event', exact: true }).click();
  await expect(adminPage.getByText('Live', { exact: true })).toBeVisible();

  // Both players flip to live within ~3s with no reload.
  await expect(a.getByRole('timer')).toBeVisible({ timeout: 4_000 });
  await expect(b.getByRole('timer')).toBeVisible({ timeout: 4_000 });

  // A late joiner sees the same shared remaining (already a few seconds in, < 60:00).
  const ctxC = await newCtx(browser);
  const c = await joinPlayer(ctxC, 'Carol Arena', 'SH3LLSH0CK');
  await expect(c.getByRole('timer')).toBeVisible({ timeout: 4_000 });

  // The board shows the 15 active missions and no difficulty level anywhere.
  await expect(a.locator('article[aria-labelledby^="mission-"]')).toHaveCount(15);
  await expect(a.getByText(/\b(EASY|MEDIUM|HARD)\b/)).toHaveCount(0);
  await expect(a.getByText(/difficulty/i)).toHaveCount(0);

  // Admin Missions: 15 missions, 2,250 points, no difficulty column or field.
  await gotoAdmin(adminPage, 'Missions');
  await expect(adminPage.getByRole('heading', { name: 'Missions' })).toBeVisible();
  const missions = (await (await adminPage.request.get('/api/admin/missions')).json()).missions as Array<{ points: number }>;
  expect(missions).toHaveLength(15);
  expect(missions.reduce((s, m) => s + m.points, 0)).toBe(2250);
  await expect(adminPage.locator('tbody tr')).toHaveCount(15);
  await expect(adminPage.getByText(/difficulty/i)).toHaveCount(0);
  await adminPage.screenshot(SHOT('08-admin-missions'));
  await adminPage.getByRole('button', { name: 'Edit' }).first().click();
  await expect(adminPage.getByLabel('Points')).toBeVisible();
  await expect(adminPage.getByText(/difficulty/i)).toHaveCount(0);
  await adminPage.getByRole('button', { name: 'Cancel' }).click();

  const [sa, sc] = [await timerSeconds(a), await timerSeconds(c)];
  expect(sa).toBeLessThan(3600); // the clock has started ticking for everyone
  expect(Math.abs(sa - sc)).toBeLessThanOrEqual(2); // shared clock: all agree

  await a.screenshot(SHOT('05-live-dashboard'));

  // Relogin keeps the same shared remaining.
  const before = await timerSeconds(a);
  await a.getByRole('button', { name: /sign out/i }).click();
  const a2 = await joinPlayer(ctxA, 'Alice Arena', 'Z3R0D4Y');
  await expect(a2.getByRole('timer')).toBeVisible();
  expect(Math.abs((await timerSeconds(a2)) - before)).toBeLessThanOrEqual(4);

  await admin.close();
  await ctxA.close();
  await ctxB.close();
  await ctxC.close();
});

test('a player solves the warmup: wrong flag rejected, correct flag scores', async ({ browser }) => {
  const ctx = await newCtx(browser);
  const page = await joinPlayer(ctx, 'Solver Arena', 'KR4CK_T3AM');
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 4_000 });

  await page.getByRole('button', { name: /open mission 01: warmup/i }).click();
  const flag = page.getByLabel('Flag');

  // Wrong flag is rejected.
  await flag.fill('CYFLAG{wrong}');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/not correct/i)).toBeVisible();

  // Correct flag scores.
  await flag.fill(FLAG);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/solved/i).first()).toBeVisible({ timeout: 5_000 });

  await ctx.close();
});

test('organizer moderation: announcement banner, score adjustment and ban', async ({ browser }) => {
  const admin = await newCtx(browser);
  const adminPage = await admin.newPage();
  await adminSignIn(adminPage);

  // Announcement shows as a player banner.
  await gotoAdmin(adminPage, 'Announcements');
  await adminPage.getByRole('button', { name: 'New announcement' }).click();
  await adminPage.getByLabel('Title').fill('Halfway there');
  await adminPage.locator('textarea').fill('Thirty minutes left — keep going.');
  await adminPage.getByRole('button', { name: 'Save' }).click();
  await expect(adminPage.getByText('Halfway there')).toBeVisible();

  const ctx = await newCtx(browser);
  const player = await joinPlayer(ctx, 'Banned Soon', '0xDEADC0DE');
  await expect(player.getByText('Halfway there')).toBeVisible({ timeout: 4_000 });

  // Score adjustment on the first leaderboard row.
  await gotoAdmin(adminPage, 'Leaderboard');
  await adminPage.getByRole('button', { name: 'Adjust' }).first().click();
  await adminPage.getByLabel(/points/i).fill('25');
  await adminPage.getByLabel('Reason').fill('first-blood bonus');
  await adminPage.getByRole('button', { name: 'Apply' }).click();

  // Ban the player → signed out with a clear message after their next load.
  await gotoAdmin(adminPage, 'Players');
  await adminPage.getByText('Banned Soon').click();
  adminPage.once('dialog', (d) => d.accept('cheating')); // window.prompt reason
  await adminPage.getByRole('button', { name: 'Ban', exact: true }).click();

  // Their session is revoked; a re-login attempt is refused with a clear message.
  await player.reload();
  await player.getByLabel('Your name').fill('Banned Soon');
  await player.getByRole('combobox').click();
  await player.getByRole('option', { name: '0xDEADC0DE', exact: true }).click();
  await player.getByRole('button', { name: /enter the arena/i }).click();
  await expect(player.getByText(/access to the event has been removed/i)).toBeVisible({ timeout: 6_000 });

  await admin.close();
  await ctx.close();
});

test('event controls: pause freezes, resume, extend, end closes submissions', async ({ browser }) => {
  const admin = await newCtx(browser);
  const adminPage = await admin.newPage();
  await adminSignIn(adminPage);
  await gotoAdmin(adminPage, 'Event');

  // Pause freezes the clock.
  await adminPage.getByRole('button', { name: 'Pause' }).click();
  await expect(adminPage.getByText('Paused', { exact: true })).toBeVisible();
  await adminPage.screenshot(SHOT('06-paused'));

  // Resume, then extend.
  await adminPage.getByRole('button', { name: 'Resume' }).click();
  await expect(adminPage.getByRole('button', { name: 'Pause' })).toBeVisible();
  await adminPage.getByRole('button', { name: '+5m' }).click();

  // End now → submissions close.
  await adminPage.getByRole('button', { name: 'End now' }).click();
  await adminPage.getByRole('button', { name: 'End event', exact: true }).click();
  await expect(adminPage.getByText('Ended', { exact: true })).toBeVisible();
  await adminPage.screenshot(SHOT('07-ended'));

  // A player can no longer submit: once ended the warmup has no enabled "open"
  // action (the server-side rejection after endsAt is covered by the API tests).
  const ctx = await newCtx(browser);
  const player = await joinPlayer(ctx, 'After Hours', 'GH0ST.PR0T0');
  await expect(player.getByRole('timer')).toBeVisible({ timeout: 4_000 });
  await expect(player.getByRole('button', { name: /open mission 01: warmup/i })).toHaveCount(0);

  await admin.close();
  await ctx.close();
});
