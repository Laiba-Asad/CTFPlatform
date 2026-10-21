# Event-day runbook — Cydemic CTF (22 October 2026)

One page. Keep it next to the VM.

## T-2 days
- Build and copy the package: `npm run package:vm` → copy `dist/cydemic-ctf-vm.zip` to the VM.
- Follow `docs/DEPLOY-WINDOWS-VM.md` steps 1-6 (install, `prod:init`, firewall, `preflight`).
- Confirm `npm run preflight` is all PASS.

## T-1 day — dry run
- `start-event.cmd`. From the organizer laptop open the players URL; sign in as a test player.
- In `/admin` (from the VM or an allowed IP): **Release all missions**, **Start event now**, solve one or two challenges, then **End event** and **Lock all**.
- `npm run exposure-check -- http://<vm-ip>:8080` from the laptop → PASS.
- `npm run backup` → confirm a snapshot appears in `backups\`.
- Stop with `stop-event.cmd`. Leave the VM on; disable sleep/hibernate; pause Windows Update.

## Morning checklist (T-30 min)
- VM on, network **Private**, fixed IP unchanged. `npm run preflight` → all PASS.
- `start-event.cmd`. Note the players URL on the board / projector.
- Open `/admin`, go to **Event** (shows "Waiting to start") and **Missions**.
- Test from a phone and a laptop on the venue Wi-Fi.

## Start sequence (at kickoff)
1. **Missions → Release all** (confirm). The header shows `15/15 released · 15/15 services up`.
2. **Event → Start event now** (confirm). The shared 60-minute clock begins for everyone.
3. Players' boards flip to live within a few seconds.

## During the event
- **A service shows down** (Missions page): click **Restart** on that mission. If it stays down, **Lock** it, tell players it is paused, investigate, then **Release** again.
- **The platform crashed / VM restarted**: run `start-event.cmd` again. The clock, scores, solves and released missions are restored from the database, and services restart. Lost time: tell players; use **Event → Extend** to add minutes.
- **A player cannot connect**: confirm they are on the venue network (not guest-isolated), using the exact URL including `:8080`, and that the firewall rules are present (`npm run preflight`). As a fallback, use your own router (see `docs/NETWORK-CHECKLIST.md`).
- Backups run automatically every 10 minutes (kept: last 20) in `backups\`.

## End sequence
1. **Event → End event** (submissions close; scores freeze and stay visible).
2. Export results: `/admin` → **Export** → Certificates / Results CSV.
3. `npm run backup` for a final snapshot. Copy `backups\` to a USB drive or cloud.
4. **Missions → Lock all**.
5. `stop-event.cmd`. Then `scripts\windows\close-firewall.ps1` (admin) if the VM stays on the network.
6. Shut down the VM.
7. On the **organizer laptop**: delete or encrypt `ORGANIZER-ANSWER-KEY.md` (it is local-only and git-ignored, never on the VM).

## Numbers to remember
- Players URL: `http://<vm-ip>:8080`  ·  Admin: same URL + `/admin` (allowed IPs only).
- 15 challenges, 2,250 points, 60-minute shared clock.
