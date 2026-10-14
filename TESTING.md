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
