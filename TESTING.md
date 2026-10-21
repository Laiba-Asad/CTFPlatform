# Testing guide — Cydemic CTF // ARENA

This is a step-by-step guide for a tester. You do **not** need to be a developer.
If anything here does not match what you see, note it as a bug (see the end).

## 1. Start the app (one command)

From the project folder:

```bash
npm install      # first time only
npm run dev
```

Wait until the terminal prints that the web app is ready, then open:

- **Players:** http://localhost:5173
- **Organizers (admin):** http://localhost:5173/admin

The first `npm run dev` also creates the organizer account from the project's
`.env` file, so you can sign in straight away.

> One command alternative (single URL, closer to the real event): `npm run build`
> then `npm run start`, and open the printed address (default http://localhost:8080).

## 2. Sign in

- **Admin username:** ask the project owner (it is "Laiba Asad" in the current
  dev setup). **The password is not written down here — ask the project owner.**
- **Players:** no password. A player types a **name** (letters, spaces, hyphens,
  apostrophes and dots — no numbers) and picks a **team** from the list.

## 3. Start the event and watch the shared clock

1. Sign in to `/admin`, open **Event**. It shows **Waiting to start**.
2. Open a few **player** windows (use separate browsers or private windows), sign
   in with different names/teams. Each one shows **"Waiting to start"**.
3. In admin **Event**, click **Start event now** and confirm.
4. Every player window should switch to its missions **within ~3 seconds, with no
   reload**, and all show the **same** countdown (one shared 60-minute clock).

What to check while live:
- A player who joins late sees the **same** remaining time as everyone else
  (the clock is shared, not per-player).
- Signing out and back in shows the **same** remaining time.
- **Pause** freezes the countdown for everyone; **Resume** continues it; **Extend
  +5/+15/+30** adds time for everyone.
- **End now** closes submissions immediately; scores stay visible but read-only.

## 4. Test checklist (expected results)

| # | Action | Expected result |
|---|---|---|
| 1 | Open `/admin`, sign in with the wrong password | Message: "Wrong username or password." |
| 2 | Sign in with the correct password | Lands on the **Overview** page |
| 3 | Sign in 6 times with a wrong password | After 5 failures: "Too many attempts, try again in N minutes" |
| 4 | Open `/admin` from a player browser (no admin sign-in) | Shows the organizer sign-in, not the dashboard |
| 5 | As a player, before the event starts | "Waiting to start" screen with your team and player count |
| 6 | Admin clicks **Start event now** | All waiting players flip to missions within ~3s; timers match |
| 7 | A player joins 10s after start | Sees ~10s less than 60:00, same as everyone |
| 8 | Player opens the Warmup mission, enters a wrong flag | "That flag is not correct" |
| 9 | Player enters the correct flag | Mission shows **Solved**; score increases once |
| 10 | Player submits the same mission again | Already solved (no extra points) |
| 11 | Open the **Leaderboard** (player and admin) | Ranking updates after a solve |
| 12 | Admin **Overview** activity feed | Shows the solve within a few seconds |
| 13 | Admin **Pause** | All player timers freeze at the same value |
| 14 | Admin **Resume** then **Extend +5** | Countdown continues, then jumps up 5 minutes |
| 15 | Admin **End now** | Players see **ENDED**; a flag can no longer be submitted |
| 16 | Admin bans a player (Players → open → Ban) | That player is signed out; re-login shows "access removed" |
| 17 | Admin adds a **score adjustment** (Leaderboard → Adjust) | The player's score changes by that amount |
| 18 | Admin posts an **Announcement** | A banner appears on the player site within a few seconds |
| 19 | Admin turns on **Maintenance** (Event page) | Players see a calm "Back soon" page; admin stays usable |
| 20 | Admin **Freeze** the leaderboard | Players see a "Frozen — snapshot" label; admin still sees live scores |
| 21 | Locked vs released mission (admin **Missions**) | Locked missions show "Locked"; releasing one makes it playable |
| 22 | Export a CSV (admin **Export** → Certificates) | A CSV downloads with name, team, rank, score, solved |
| 23 | **Viewer** admin account (Settings → create a viewer) | Viewer can read every page but every change button is disabled |
| 24 | Look at the mission board and open any mission | Points, category, solver count and state only. **No** EASY / MEDIUM / HARD and no difficulty dots anywhere |
| 25 | Count the mission cards | **15** missions, ordered by points (lowest first); worth **2,250** points in total |
| 26 | Open any mission and read its briefing | Solvable with the browser and DevTools only (plus the in-site **Toolkit**); nothing to install |
| 27 | Admin **Missions** page | 15 rows, no difficulty column, the edit dialog has no difficulty field |
| 28 | Open the **Toolkit** page (sidebar) | Base64/hex/ROT13/URL/binary decoders that work offline; type text and see it convert |
| 29 | Run `npm run doctor` while the event is live and everything is released | `15 up, 0 starting, 0 down (15 released of 15 with a service)`; no retired challenge listed |

## 4b. The challenges on the board

15 challenges, **2,250 points**, chosen so beginners can finish within the
one-hour clock. **Every one is solvable with just a web browser and its built-in
DevTools** - no Burp, nmap, Wireshark, curl or anything to install. The in-site
**Toolkit** page handles any decoding (Base64, hex, ROT13, URL, binary).

| id | Title | Points | Port | Where to look (browser only) |
|---|---|---|---|---|
| web1 | The Snack Cabinet | 100 | 5001 | DevTools > Application > Cookies |
| web14 | Open the Hood | 100 | 5014 | View Source / Inspect |
| web15 | Decode Me | 100 | 5015 | DevTools > Sources, then the Toolkit |
| web19 | Invisible Ink | 100 | 5019 | Select All / Inspect Element |
| web20 | Locked Button | 100 | 5020 | DevTools > Elements (enable the button) |
| web16 | Header Hunt | 150 | 5016 | DevTools > Network (Preserve log) |
| web17 | Price Tag | 150 | 5017 | DevTools > Elements (edit a hidden field) |
| web18 | Layers | 150 | 5018 | the Toolkit (Base64, ROT13) |
| web21 | Storage Locker | 150 | 5021 | DevTools > Application > Local Storage |
| web22 | Console Whisper | 150 | 5022 | DevTools > Console |
| web23 | Gatekeeper | 150 | 5023 | DevTools > Sources (read the script) |
| web2 | Restricted Area | 200 | 5002 | /robots.txt in the browser |
| web24 | Badge Check | 200 | 5024 | DevTools > Application > Cookies (edit) |
| web25 | Guest List | 200 | 5025 | the address bar (change the ticket id) |
| net5 | Plain Text | 250 | 5026 | the in-site Capture Viewer (filter, follow stream) |

**New** for the 22 October 2026 event: web19-web25, net5 (and the reworked web16,
web17, web18 from the previous round).
**Retired** (removed from the board, kept aside in `challenge-services/_retired/`):
web3-web13 (except the kept ones), net1-net4. They must not appear anywhere.

Flags and intended solutions are in the organizer's local `ORGANIZER-ANSWER-KEY.md`
(never shared). Testers should solve without it, then report anything that felt
unclear or took more than a few minutes.

Automated checks (run by a developer): `npm run typecheck`, `npm test` (brand,
security and unit/API tests), `npm run test:e2e` (browser journeys), and in
`challenge-services`: `.venv/Scripts/python -m pytest` (a solve test and a
no-leak test for every challenge).

## 5. Reset the data between test rounds

To clear players, solves, submissions, adjustments and announcements and reset the
clock to "waiting" — while keeping teams, challenges, admin accounts and settings:

```bash
npm run event:reset
```

It backs up the database first (prints the path) and asks you to type `RESET`.

## 6. Report a bug

For each issue, note: **what you did**, **what you expected**, **what happened**,
the **page/URL**, and your **browser**. A screenshot helps. Include the time, so
the organizer can match it to the server's **Audit log** (admin → Audit log).
Do **not** include any flag value or password in a bug report.

## 7. Production (Windows VM) checks

These run in production mode (`NODE_ENV=production`). Full steps are in
`docs/DEPLOY-WINDOWS-VM.md` and `docs/EVENT-DAY-RUNBOOK.md`.

| # | Action | Expected result |
|---|---|---|
| P1 | `npm run preflight` after `prod:init` + firewall | Every line **PASS**; exits 0 |
| P2 | Open `http://<vm-ip>:8080` from a player laptop | Login screen with six teams |
| P3 | Open `http://<vm-ip>:8080/admin` from a **non-allowed** machine | Plain **404** (login not shown) |
| P4 | Open `/admin` from the VM (or an allowed IP) | Organizer sign-in |
| P5 | `npm run exposure-check -- http://<vm-ip>:8080` from the laptop | **PASS**; nothing sensitive reachable, `/admin` blocked |
| P6 | Before **Start event now**, open a released mission | Not openable ("opens when the event starts") |
| P7 | **Missions → Release all**, then **Event → Start event now** | Confirmations shown and audited; board goes live; `15/15 released · 15/15 services up` |
| P8 | Restart the VM mid-event, run `start-event.cmd` again | Clock, scores, solves and released missions intact; services restart |
| P9 | `npm run backup` / `npm run restore -- <file>` | Snapshot written; restore takes a safety backup and asks to confirm |

**Verified test counts:** 31 shared · 146 API · 8 web/toolkit · 65 challenge-service
(pytest) · 13 Playwright = **263 automated tests**, all passing. Load test: 40
players, 0 errors, API p95 ~100 ms.
