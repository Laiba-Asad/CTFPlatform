# Technical overview — Cydemic CTF // ARENA

Written for management and non-specialist stakeholders. Plain language. All
numbers below were counted from the codebase, not estimated.

## What it is

A self-hosted platform for running a Capture-the-Flag (CTF) competition on a local
network (LAN). Players sign in with a name and a team, solve security challenges,
submit "flags" to score, and see a live leaderboard. Organizers run the event from
a separate admin dashboard: one shared countdown, releasing challenges, moderating
players, adjusting scores, and exporting results.

## By the numbers (verified)

- **15 challenges**, **2,250 points** total, built so beginners can finish on a
  one-hour clock. **Every challenge is solvable with just a web browser and its
  built-in DevTools** (plus an in-site decoder Toolkit) - nothing to install.
  **15 challenge services** run during the event.
- Players see points, category and solver count; there is **no difficulty
  level** anywhere (removed from the site, the admin, the API and the database).
- 15 harder or tool-dependent challenges were retired across phases and kept
  aside (inert) so they can be restored later.
- **70 API endpoints** across players and admin.
- **263 automated tests**: 146 API/integration (incl. production static-exposure,
  admin-IP restriction and restart-resilience), 31 shared-logic, 8 web/toolkit,
  65 challenge-service tests (solve, no-leak, cookie isolation, browser-only
  audit), plus **13 end-to-end browser tests** (real Chromium). Validated
  end-to-end in production mode: a fresh install from the package zip, `prod:init`,
  `preflight`, `exposure-check`, and a full solve of two challenges.
- **6 teams**, one shared **60-minute** event clock (configurable).

## Technology (exact versions)

**Server (Node.js 24)**
- Express 5.3 (web server), Zod 4.6 (input validation), Prisma 7.10 (database),
  Helmet 8.3 (security headers), pino 10 (logging).
- Database: **SQLite** for the LAN deploy (zero-setup, one file), switchable to
  **PostgreSQL** by changing one environment variable.

**Web app (browser)**
- React 19.3, Vite 8.3 (build tool), React Router 8.4, TanStack Query 5
  (live polling). Tailwind CSS 4 with a locked design-token palette.

**Challenge services (Python 3)**
- Flask 3.1.0, Werkzeug 3.1.3, waitress 3.0.2, PyJWT 2.10.1, itsdangerous 2.2.0;
  scapy 2.6.1 is used only to pre-generate network-capture files.

**Testing**: Vitest (unit/integration) and Playwright 1.64 (end-to-end).

## How it is organised

```
apps/
  api/     Node + Express backend (auth, events, scoring, admin, challenge supervisor)
  web/     React player site and the /admin organizer dashboard (one build)
packages/
  shared/  Types and rules shared by both sides (one source of truth)
challenge-services/  Python processes, one per challenge service, started on demand
seed/      Teams, event and challenge definitions
```

## Architecture in brief

- **One source of truth for the event.** A single database row holds the event
  status (waiting / live / paused / ended) and the shared clock. The **server**
  decides the time; browsers only display it, corrected for their own clock drift,
  so a player with a wrong device clock still sees the correct countdown, and late
  joiners and re-logins see the same remaining time as everyone else.
- **Scores are always derived** from solve records plus organizer adjustments by a
  single function used by both the player and admin views, so they can never
  disagree. Flags are never stored or sent in plaintext — only salted hashes.
- **Two separate areas.** The player site and the `/admin` dashboard have separate
  logins, cookies and cross-site-request protections. The admin area is restricted
  to the organizers' machines (localhost by default).
- **Challenge isolation.** Each challenge service runs as its own Python process,
  started and stopped by a supervisor as organizers release or lock it; a crash of
  one challenge cannot take down the platform.

## Security measures

- Separate player and admin authentication; passwords (admin only) stored with a
  slow `scrypt` hash; session tokens stored only as hashes.
- Login lockout after repeated failures; signed double-submit CSRF protection;
  strict security headers (Content-Security-Policy, no framing).
- The admin area is limited to **exact IPs** (`ADMIN_ALLOWED_IPS`); in production
  everyone else gets **404**, so players cannot even see the organizer login.
  Every admin action is written to an **append-only audit log**; destructive
  actions require typed confirmation and take a database backup first.
- Production **refuses to start** on unsafe config (dev secrets, `AUTO_UNLOCK_ALL`,
  `EVENT_MODE=live`, a weak/default admin password, an unreset `admin:seed-dev`).
  The API serves only the built web app; a static-exposure test proves the answer
  key, `.env`, `.flags.env`, `.git`, databases and backups all return 404/403.
- Everything is self-hosted (no external CDNs or fonts), so it runs on an offline
  LAN. Automated checks fail the build if a flag literal, an external URL, or an
  unguarded admin route is introduced.

## Running the event on a Windows VM (production)

1. On the VM: `npm ci`, `npm run challenges:setup`, then `npm run prod:init`
   (writes `.env` with strong random secrets and the detected LAN IP, migrates,
   seeds the 15 challenges **locked**, and rehashes every flag into the database
   with the new pepper).
2. Create an organizer account: `npm run admin:create` (min 12 characters).
3. Open the firewall (`scripts\windows\open-firewall.ps1`, admin PowerShell) and
   run `npm run preflight` until every line is **PASS**.
4. Double-click **`start-event.cmd`**. Players open `http://<vm-ip>:8080`.
5. In `/admin`: **Release all missions**, then **Start event now**.

Load test: 40 concurrent players sustained **0 errors** with API **p95 ~100 ms**.
Full operator steps: `docs/DEPLOY-WINDOWS-VM.md`; runbook: `docs/EVENT-DAY-RUNBOOK.md`.

## Known limits and risks

- **SQLite** is ideal for a single LAN server (hundreds of players). A very large
  or multi-server event should switch to **PostgreSQL** (supported, one setting).
- The admin **login lockout** is held in memory per server process, so it resets
  if the API is restarted. This is intentional for a single-server event.
- **Challenge ports (5001, 5002, 5014–5026) must be exposed directly, not behind a
  reverse proxy** (documented in the README): players open each target in the
  browser at its own port.
- Set the **real event start time** before the event: the example configuration
  ships a placeholder window (22 Oct 2026, 10:00–14:00 Asia/Karachi).
- The organizer dashboard is intended for a trusted LAN; exposing it to the open
  internet is out of scope and not recommended.
