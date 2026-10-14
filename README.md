# Cydemic CTF // ARENA

Capture-the-flag competition platform for Cydemic.

> **Status: Phase 2 + 2B + 2C (Auth, teams, challenges, LAN).** Open-join login
> (players create themselves on first login), sessions, CSRF, LAN deployment
> settings, team badges, the dashboard and profile, all 15 challenges imported
> and hardened (web services + net captures), flag submission with scoring, and
> admin release control. The leaderboard, achievements and admin UI arrive in
> later phases.

## Quick start

Requirements: Node.js 20.19+ (developed on Node 24) and npm 10+.

```bash
npm install
npm run dev
```

- Web: http://localhost:5173 (design preview at `/design`, dev only)
- API: http://localhost:4000 (also reachable through the web dev server at `/api` and `/healthz`)

`npm run dev` prepares the database first: it generates the Prisma client,
applies migrations to `apps/api/dev.db` (SQLite) and, if the database is empty,
seeds the 6 placeholder teams, a placeholder event window and the challenges.
No players are pre-created: open the app, enter any name and pick a team to join.

No `.env` is needed for local development: safe defaults are used, and the API
logs a warning that it is running with development secrets. To customise
anything, copy `.env.example` to `.env`; every variable is documented there.

## Scripts (run from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API first, waits for `/api/health`, then the web dev server. Names the process holding a busy port; Ctrl+C stops both cleanly |
| `npm run doctor` | Prints platform health as a table (DB, event state, released challenges, per-service up/down) |
| `npm run start` | Builds and serves the web app + API from one port (`SERVE_PORT`, default 8080) for the LAN |
| `npm test` | Brand + security checks and all unit/API/web tests (throwaway SQLite DB) |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run build` | Production builds of API (server + scripts) and web |
| `npm run check:brand` | Design-system guard (see Design system) |
| `npm run seed` | Idempotent seed: teams, event (mode + window), challenges (no players) |
| `npm run seed -- --update-event` | Overwrite the event dates and mode from `EVENT_*` env / `seed/event.json` |
| `npm run reset` | **Destroys all data** (backs up first, asks for confirmation): drops tables, re-migrates, re-seeds |
| `npm run dev:clean-players` | Removes all players (keeps teams, challenges, event). Backs up first, asks for confirmation |
| `npm run admin:create` | Create an organizer account for `/admin` (prompts for the password; never echoed, never on the CLI) |
| `npm run admin:reset-password` | Set a new password for an existing organizer account and sign out its sessions |
| `npm run admin:seed-dev` | Dev only: create/update the organizer from `DEV_ADMIN_*` in `.env` (first `npm run dev` runs this automatically) |
| `npm run event:reset` | Clear players/solves/submissions/adjustments/announcements and reset the clock to "waiting" (keeps teams, challenges, admins, settings, audit). Backs up first |
| `npm run test:e2e` | End-to-end browser journeys (Playwright, Chromium) on a separate DB and port; saves screenshots to `apps/web/e2e-screenshots/` |
| `npm run join-link` | Print the LAN join link and a QR code for players |
| `npm run challenges:setup` | Create the Python venv for the challenge services |
| `npm run challenges:captures` | Generate + verify the net1/net2 capture files |
| `npm run flag:hash` | Write `seed/challenges.json` (salted HMACs) from meta + `.flags.env` |
| `npm run db:pg-sync -- <name>` | Regenerate the PostgreSQL schema/migration after a schema change |

## Event state (one source of truth)

The event state lives in a single `Event` row and is the only thing that gates
the timer, mission availability and flag submission (all enforced on the server,
on server time). The `/api/event` response includes the server clock so the
countdown never depends on a player's device.

- **mode** = `scheduled` (follow the dates) | `live` (force live) | `paused` | `ended`.
  Seed it with `EVENT_MODE` (and `EVENT_START` / `EVENT_END` for the dates).
- **Default mode: `live` in development** (so you can always test) and
  **`scheduled` in production**. `EVENT_MODE=live` is **refused in production**.
- Admin API (guarded): `GET /api/admin/event`, `PUT /api/admin/event` with
  `{ mode?, startsAt?, endsAt? }`. The admin dashboard will use these.
- Top bar: `STARTS IN DD:HH:MM:SS` → `TIME LEFT HH:MM:SS` (with a teal pulse in
  the last 10 minutes) → `PAUSED` → `ENDED`. A player's solves and score never
  change with the event state.
- Mission cards state the real reason, never a bare "LOCKED": `OPENS AT START`,
  `PAUSED`, `EVENT ENDED` (event), `LOCKED` (admin hasn't released it),
  `STARTING…` / `TEMPORARILY UNAVAILABLE` (service health), or `SOLVED`.

## Health and data safety

- **`/api/health`** (and `/healthz`) report DB status, event mode/phase, released
  challenge count and per-service up/down. `npm run doctor` prints the same table.
- **Backups**: the API snapshots the SQLite database to `apps/api/backups/` on
  start and daily, keeping the last 10. **Restore** by stopping the API and
  copying a `apps/api/backups/ctf-*.db` over `apps/api/dev.db` (for PostgreSQL,
  use `pg_dump`/`pg_restore`). Nothing in dev, seed, startup or a normal restart
  deletes players, solves or scores — only `npm run reset` (confirmed) does.
- Released challenge state persists across restarts; the supervisor re-starts
  every released service on boot and shows each one's status on the cards.

## Players, teams and login

- **Open join, no sign-up page.** There is no register/"create account" UI,
  route or API. A player enters a **name** and picks a **team**; the first use
  of a name creates the account on that team, later uses sign back into it.
  Admins will monitor players live from the admin dashboard (later phase).
- **Name matching** ignores case, extra spaces and accents: `laiba  asad`
  matches `Laiba Asad`. Names may contain letters, spaces, hyphens, apostrophes
  and dots (2-40 characters). The account stores the name exactly as entered.
- **Same name, different team** is rejected with: "This name is already
  registered with another team. Use the team you joined with, or ask an
  organizer." Returning players (same name + team) get the same account, score
  and progress.
- **Limits** (all keyed to survive a shared LAN IP): a per-(IP+name) and looser
  per-IP failure cooldown of `COOLDOWN_SECONDS` (default 30, **hard maximum
  30**, same cooldown as flag submission), an optional `MAX_PLAYERS_PER_TEAM`
  cap (0 = unlimited), and a new-accounts-per-IP rate limit
  (`NEW_PLAYERS_PER_IP`, default 20 per 10 min, `NEW_PLAYER_IP_LIMIT=false` to
  disable). The login screen shows "Try again in 24s" during a cooldown.
- **Teams** come from `seed/teams.json` (ids `z3r0d4y`, `n0-tr4c3`,
  `sh3llsh0ck`, `kr4ck-t3am`, `0xdeadc0de`, `gh0st-pr0t0`). A team's badge is
  `apps/web/public/avatars/<team-id>.png` and is the player's avatar everywhere
  (login dropdown, sidebar, hero, leaderboard, profile). A neutral placeholder
  shows until the image exists.
- **Admins** (`role = admin`) cannot sign in through the player login; that name
  is reported as unavailable. Admin routes under `/api/admin` are guarded by
  `requireAdmin`; the admin login and dashboard come later.

### Database

- Dev uses SQLite at `apps/api/dev.db`. Set `DATABASE_URL=postgresql://...` to
  use PostgreSQL, then run `npm run db:generate -w @cydemic/api` (the Prisma
  client is generated per provider) and `npm run db:deploy -w @cydemic/api`.
- `apps/api/prisma/schema.prisma` is the single source of truth. After changing
  it: `npm run db:migrate -w @cydemic/api -- --name <change>` (SQLite migration),
  then `npm run db:pg-sync -- <change>` (PostgreSQL schema + migration, generated
  offline). Commit both migration folders.
- Sessions: a random 256-bit token lives in an httpOnly, SameSite=Lax cookie
  (`__Host-` prefixed and Secure over HTTPS). Only its SHA-256 hash is stored.
- CSRF: signed double-submit token (`X-CSRF-Token` header), plus an Origin check.
- Prisma blocks destructive commands such as `migrate reset` when an AI coding
  agent runs them without your explicit consent. When you run `npm run reset`
  yourself in a terminal, it simply works.

## Challenges and challenge services

The platform ships 15 challenges (13 web, 2 network), each imported from the
prior CTF and hardened. The web challenges run as small Python (Flask +
waitress) services, one OS process per challenge, supervised by the API. The
network challenges are pcapng captures served through an authorized route.

### One-time setup (in order)

```bash
npm install                       # workspaces + Prisma client
npm run challenges:setup          # create challenge-services/.venv, install pinned deps
# Import the challenge flags/secrets into the git-ignored .flags.env:
python challenge-services/build_flags_env.py <path-to-old/app.py>
npm run challenges:captures       # generate + verify net1/net2 pcapng files
npm run flag:hash                 # write seed/challenges.json (salted HMACs; no plaintext)
npm run dev                       # applies migrations, seeds, runs API + web
```

`seed/challenges.meta.json` is editable (titles, descriptions, points, ports);
it contains **no flags**. `npm run flag:hash` combines it with `.flags.env` into
`seed/challenges.json`, replacing each flag with `HMAC(FLAG_PEPPER, salt+flag)`.
Because the hash depends on `FLAG_PEPPER`, set a real pepper on the server and
re-run `npm run flag:hash` (then re-seed) before the event.

### How flags stay secret

- Plaintext flags live only in `challenge-services/.flags.env` (git-ignored) and
  are passed to each challenge process through its environment. They never enter
  the repo, the platform database (only salted HMACs), API responses or logs.
- The capture generator reads flags from `.flags.env`; `net2`'s flag is split
  across packets so it is never contiguous in the file bytes.

### Release control

Each challenge is **released** (unlocked) or locked, stored in the database and
surviving restarts. Releasing a web challenge starts its service; locking stops
it. Organizers control this from the **Missions** page of the admin dashboard
(see below). For local dev, `AUTO_UNLOCK_ALL=true` releases everything at seed
time. The supervisor re-starts every released service after a platform restart
and stops all of them (no orphans) on shutdown. Set `CHALLENGES_ENABLED=false`
to skip the supervisor (e.g. to run the platform without Python).

## Admin dashboard (organizers)

The organizer dashboard lives at **`/admin`**, entirely separate from the player
site: its own login, session cookie (`cydemic_ctf_admin_sid`), CSRF token and
polling. It is never reachable with a player account.

- **Access.** By default `/admin` and `/api/admin/*` are reachable **only from
  localhost**. Allow specific organizer machines on the LAN with
  `ADMIN_ALLOWED_SUBNETS` (comma-separated CIDRs). Everyone else gets a 403.
- **Accounts.** There is no default password. Create the first organizer with
  `npm run admin:create` (it prompts for the password, which is never echoed,
  never logged and never accepted on the command line, and is stored only as a
  slow scrypt hash). Rotate a password with `npm run admin:reset-password`.
  - **Dev convenience:** set `DEV_ADMIN_USERNAME` / `DEV_ADMIN_PASSWORD` in your
    git-ignored `.env` and the first `npm run dev` creates that organizer
    automatically (or run `npm run admin:seed-dev`). **This is for development
    only — change this password (or use `admin:create`) before any real event.**
- **Shared event clock.** With `TIMER_MODE=event` (default) the event is one
  shared `EVENT_DURATION_MINUTES` clock. Before it starts, signed-in players see a
  calm "waiting to start" screen; the organizer presses **Start event now** on the
  Event page and every player flips to live within ~3 seconds, all counting down to
  the same end time (server-authoritative, corrected for each device's clock).
  **Pause** freezes the remaining time for everyone, **Resume** continues it,
  **Extend** adds time, and **End now** closes submissions.
- **Roles.** `admin` can do everything; `viewer` is read-only (every mutation is
  rejected for viewers, enforced server-side). Add more accounts and change
  roles from **Settings**.
- **Sessions.** Idle timeout `ADMIN_IDLE_TIMEOUT_MIN` (default 60) and a hard cap
  `ADMIN_MAX_SESSION_HOURS` (default 8). Login lockout after
  `ADMIN_LOGIN_MAX_FAILURES` (default 5) for `ADMIN_LOCKOUT_MINUTES` (default 15).
- **Audit log.** Every admin action is appended to an **append-only** audit log
  (who, what, target, before/after, IP, time), browsable under **Audit log**.
- **Destructive actions** require confirmation; the most dangerous (e.g. delete
  player) require typing the exact target name, and a database backup is taken
  first.

Pages: Overview (live stats, activity feed, service health, attention list),
Event (mode, schedule, extend, freeze, maintenance), Missions (release / lock /
edit / service control / solvers), Players (ban, rename, move, reset, delete,
merge, detail drawer), Teams (player cap, lock joining), Submissions (incl.
wrong-guess text and flag-reuse highlight, CSV), Leaderboard (score adjustments
and recompute — always live for admins), Announcements, Settings (platform
toggles, accounts, backups), Audit log, Export (results/certificates/solves/
submissions as CSV/JSON).

**Effects on the player site** (the only player-visible changes): an announcement
banner, a calm maintenance page, the banned and signup-closed messages, a
"frozen — snapshot" leaderboard label, and scores that include organizer
adjustments. Scores are **always derived** from solve records plus adjustments
by one shared function, so player and admin views can never disagree.

### Network and reverse-proxy notes (important for the server)

- **Challenge ports (5001-5013) must be exposed directly, never through the
  platform's reverse proxy.** `web4` trusts `X-Forwarded-For`, which a proxy
  rewrites; proxying would also break the intended challenge. Players reach
  targets at `http://<platform-host>:<port>/` (the target link is built in the
  browser from the host the player used, never a hard-coded address).
- `web11`/`web13` run on the same host as the platform, so platform session
  cookies are httpOnly, CSRF is mandatory, and credentialed cross-origin
  requests are rejected (tested). The platform session cookie name is unique
  (`cydemic_session`) to avoid collisions with challenge cookies.
- Everything is self-hosted: no CDN or Google Fonts, so the platform and the
  challenge pages work on an offline LAN.
- Scanners/automated tools: each service has a coarse in-flight concurrency cap
  (default 8, `CHALLENGE_MAX_CONCURRENCY`) so one noisy player cannot freeze it.

### Tests

- Python: `cd challenge-services && .venv/Scripts/python -m pytest` — per-challenge
  solve tests, no-leak tests, per-visitor isolation (`web11`), the `web13` gate,
  and static checks (no debugger, no command execution in `web08`, no external URLs).
- Node: flag hashing, the challenges API (list/submit/rate-limit/cooldown/attachment),
  admin release, and a supervisor integration test (start/serve/stop, crash-restart,
  no orphans) that auto-skips until the venv and `.flags.env` exist.
- `npm run check:static` fails the build on a plaintext flag literal in any tracked file,
  a debugger/reloader or command-execution API in the services, an external asset
  URL in the web app or challenge templates, or a tracked secret/generated file.

## Repository layout

```
apps/
  api/            Express + TypeScript REST API
  web/            React + Vite + TypeScript + Tailwind frontend
    public/brand/   cydemic-logo.svg (placeholder: replace with the real logo)
    src/styles/     theme.css = design tokens (the only place brand values live)
    public/avatars/ team badge art, <team-id>.png (placeholder shown until added)
    src/components/ui/  component library
packages/
  shared/         Logic and types shared by API and web (timer rules, name matching, API types)
challenge-services/  Python package: web01-web13 Flask services, common.py, serve.py,
                     generate_captures.py, templates/, tests. venv + .flags.env + generated/
                     + runtime/ are git-ignored.
seed/             teams.json, event.json (placeholder dates),
                  challenges.meta.json (editable, no flags) -> challenges.json (hashes)
deploy/           Caddy configs for the reverse proxy and the static web container
scripts/          Repo tooling (brand guard, security static checks, challenge setup)
storage/attachments/  Reserved for future per-event attachment uploads (git-ignored)
```

## Design system

Calm, flat and professional: a black frame (60px top bar, 240px sidebar), a
light grey page, and white cards with thin borders. Teal only marks something
active or in progress. All tokens live in `apps/web/src/styles/theme.css`.

| Token | Value | Used for |
|---|---|---|
| `teal` | `#03DAAA` | Active nav item, timer, progress fill, "you" leaderboard row, solved card border |
| `teal-dark` | `#027A5F` | Small labels on white (kickers, SOLVED); 5.3:1 on white |
| `ink` | `#151515` | Text, primary (black) buttons, difficulty dots |
| `black` | `#101114` | Top bar and sidebar only |
| `bg` | `#F4F6F7` | Page background |
| `white` | `#FFFFFF` | Cards |
| `line` | ink at 16% | Card borders and dividers |

Tailwind's default colors, type scale, shadows and blurs are removed from the
theme, so off-brand hues, giant headlines and glows can't be produced by accident.

| Mission state | Treatment |
|---|---|
| Available | White card, grey AVAILABLE label, black START pill |
| Solved | Teal 1.5px border, teal-dark check + SOLVED, outlined VIEW pill |
| Locked | Dashed border, card at 55% opacity, lock icon, dashed disabled button |
| Difficulty | Ink-filled vs empty dots + EASY / MEDIUM / HARD |
| Error / warning | Dashed / bold ink border with an icon, never red |

Type (self-hosted via `@fontsource`): Anton **only** for the hero player name
(32px) and page titles (26px), both defined in `components/ui/Display.tsx`.
Space Grotesk for card titles, nav, buttons and labels; IBM Plex Sans for body
text; IBM Plex Mono for numbers, XP and the timer. Nothing exceeds 32px.

Avatars: every player/team slot uses `<Avatar>`. Until real badge art exists it
shows a dashed placeholder with a person icon. Put images at
`apps/web/public/avatars/<team-id>.png` and they appear everywhere with no code change.

`npm run check:brand` (part of `npm test`) fails on raw colors in components,
shadows, text-shadow, gradients, blur, scanlines, HudCorner, the removed pixel
font, type above 32px, thick borders, and Anton outside `Display.tsx`.

Accessibility: AA text contrast (checked for every text/background pair),
2px teal focus outline with 2px offset, keyboard-operable components, native
`<dialog>` modals, ARIA on timer/progress/difficulty, and animation (the
final-10-minute timer blink) disabled under `prefers-reduced-motion`.

## Local server (LAN) deployment

The platform is built to run on a local server and be reached by players on the
same network at the server's address (e.g. `http://192.168.1.50` or
`http://ctf.local`). It does not need the public internet, Docker, or HTTPS.

Build and run without Docker:

```bash
# On the server, once:
npm ci
npm run challenges:setup
python challenge-services/build_flags_env.py <path-to-old/app.py>   # or copy .flags.env over
npm run challenges:captures
# Set a real FLAG_PEPPER and SESSION_SECRET in .env, then:
npm run flag:hash
npm run build

# Run (serve the built web with any static server; the API serves the rest):
#   API:  NODE_ENV=production HOST=0.0.0.0 npm run start -w @cydemic/api
#   Web:  serve apps/web/dist on port 80 (or your choice), proxying /api to the API
npm run join-link     # prints the join URL + a QR code to share
```

Key `.env` for a plain-HTTP LAN:

```ini
NODE_ENV=production
HOST=0.0.0.0
PUBLIC_URL=http://192.168.1.50          # the server's LAN address or hostname
ALLOWED_ORIGINS=http://192.168.1.50
ALLOWED_SUBNETS=192.168.1.0/24          # optional: only this subnet may connect
COOKIE_SECURE=auto                      # stays non-secure because PUBLIC_URL is http
TRUST_PROXY=1                           # if the web server proxies /api to the API
SESSION_SECRET=...                      # required
FLAG_PEPPER=...                         # required; re-run flag:hash after setting
```

- **Challenge ports 5001-5013 must be reachable directly** (the target links
  point at `PUBLIC_URL`'s host + port), never behind a proxy. Open them in the
  server firewall along with the web port.
- **Optional HTTPS with an internal certificate:** set `COOKIE_SECURE=true` and
  a `https://` `PUBLIC_URL`. Players will see a browser warning for a self-signed
  cert; import your internal CA on each device to remove it.
- SQLite runs in WAL mode with a busy timeout for many concurrent players.
  Live updates poll every 12-15s (`VITE_POLL_INTERVAL_MS`).

### Pre-event checklist

- [ ] Server has a **fixed IP or hostname**; set `PUBLIC_URL`/`ALLOWED_ORIGINS` to it.
- [ ] Firewall: open the web port and the challenge ports (5001-5013).
- [ ] **Server clock is synced** (NTP) - the event timer is server-authoritative.
- [ ] Disable sleep and automatic restarts/updates for the event window.
- [ ] Set real `SESSION_SECRET` and `FLAG_PEPPER`, then `npm run flag:hash` and re-seed.
- [ ] Set the real event dates and `EVENT_MODE=scheduled` (`EVENT_START`/`EVENT_END`, or `seed/event.json`), then `npm run seed -- --update-event`. **Confirm the exact start time and duration with the organizers** — `.env.example` currently carries a placeholder window (22 Oct 2026, 10:00-14:00 +05:00).
- [ ] Create at least one organizer account: `npm run admin:create`. Set `ADMIN_ALLOWED_SUBNETS` if organizers run the dashboard from the LAN (default is localhost only).
- [ ] Drop real team badges into `apps/web/public/avatars/<team-id>.png` and the real logo.
- [ ] Schedule database backups (copy `apps/api/dev.db*`, or `pg_dump` for PostgreSQL).
- [ ] Test from a **phone and a laptop** on the same network; scan the `join-link` QR.

## Docker (optional, server only)

Docker is **not required** - the platform runs fully with the Node/Python flow
above. Docker files are provided for a containerised server if you prefer one.

```bash
cp .env.example .env    # then set SESSION_SECRET and FLAG_PEPPER
docker compose up --build
```

Three containers: `api` (Node), `web` (static files served by Caddy) and
`proxy` (Caddy). Caddy's automatic HTTPS needs a public domain and will **not**
work on an isolated LAN; for a LAN, serve plain HTTP (set `SITE_ADDRESS` to the
server address). The api container applies migrations on start; seed manually:

```bash
docker compose exec api node dist/seed.js
```

For PostgreSQL set `DOCKER_DATABASE_URL` and `DOCKER_DB_PROVIDER=postgresql`.
The Docker setup has not yet been run end to end (Docker was not available on
the development machine); verify it before the event.

## Security notes

- Dependency audit: run `npm audit` before every deploy. `overrides` in the root
  `package.json` pin patched versions of esbuild, and of `deepmerge-ts` and
  `mysql2` (both pulled in by the Prisma CLI; MySQL is not used).
- `/healthz` is the health endpoint for the deploy and container health checks.
- The API sends a locked-down CSP and Helmet headers, uses a CORS allowlist from
  env, and never returns stack traces in production. Cookies, CSRF tokens and
  flag fields are redacted from logs.
