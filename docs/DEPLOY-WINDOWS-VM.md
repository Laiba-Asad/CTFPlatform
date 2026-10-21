# Deploying Cydemic CTF on a Windows 10 VM

For a one-day, LAN-only event (up to ~40 players). No Docker, no reverse proxy,
no public internet. Players open the platform from their own laptops using the
VM's LAN address.

Everything below is run **on the VM** unless it says otherwise.

---

## 0. Before you start

- A Windows 10 VM with **bridged / external-switch** networking (see
  `docs/NETWORK-CHECKLIST.md`), a fixed LAN IP, and the network profile set to
  **Private**.
- The organizer's laptop LAN IP (to allow `/admin` from it).
- The package `cydemic-ctf-vm.zip` built on your dev machine with
  `npm run package:vm` (it excludes the answer key, `.env`, databases and backups).

## 1. Install the runtimes

1. **Node.js LTS (20.19+ or 22+)** — https://nodejs.org → "LTS" → run the MSI,
   accept defaults. Verify in a new PowerShell:
   ```powershell
   node -v
   ```
2. **Python 3.12** — `winget install Python.Python.3.12` (or the python.org
   installer, ticking "Add python.exe to PATH"). Verify:
   ```powershell
   python --version
   ```
3. If `npm` is blocked by the execution policy, allow it for your user:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

## 2. Copy and unzip the package

1. Copy `cydemic-ctf-vm.zip` to the VM (e.g. `C:\CTF\`).
2. Right-click → **Extract All** into `C:\CTF\CTFPlatform`.
3. Open PowerShell in that folder:
   ```powershell
   cd C:\CTF\CTFPlatform
   ```

## 3. Install dependencies and the Python environment

```powershell
npm ci
npm run challenges:setup      # creates challenge-services\.venv and installs pinned deps
```

## 4. One-time production setup

This writes `.env` with strong random secrets and the VM's detected LAN address,
applies migrations, seeds the 15 challenges (locked), and rehashes every flag
into the database with the new pepper.

```powershell
# Port 8080 (recommended). Add your laptop's IP so you can open /admin from it.
npm run prod:init -- --port 8080 --admin-ip 192.168.1.20
```

- To let the script auto-detect the VM IP, omit `--ip`. To force a specific IP:
  `--ip 192.168.1.50`.
- It prints the exact URL players will use, e.g. `http://192.168.1.50:8080`.

Create the organizer account (you type the password; it is never shown, min 12
characters):

```powershell
npm run admin:create
```

## 5. Open the Windows firewall (administrator PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\open-firewall.ps1 -WebPort 8080
```

This opens TCP **8080** and **5001-5026** on the **Private** profile, **LocalSubnet
only**. It opens nothing else. Remove later with `close-firewall.ps1`.

## 6. Preflight

```powershell
npm run preflight
```

Every line should say **PASS**. Fix any FAIL (each prints the fix) and re-run. It
checks secrets, config, ports, firewall rules, migrations, the 15 challenges and
their flag hashes, the admin password, disk space, sleep/hibernate and the clock.

## 7. Start the platform

Double-click **`start-event.cmd`** (or run `npm run start:prod`). It builds, then
serves everything on one port and prints:

```
Players open:  http://192.168.1.50:8080
Admin on the VM: http://192.168.1.50:8080/admin
```

Leave this window open for the event. **`stop-event.cmd`** stops everything.

## 8. Check from another machine

From the organizer laptop (and ideally a phone), open the players URL. Then run
the exposure check from the laptop against the VM:

```powershell
npm run exposure-check -- http://192.168.1.50:8080
```

It must report **PASS** (nothing sensitive reachable; `/admin` blocked from the
laptop unless you allowed its IP).

## 9. Run the event

See `docs/EVENT-DAY-RUNBOOK.md`.

---

## Port 80 instead of 8080

Port 80 gives a no-port URL (`http://192.168.1.50`) but is often held by a Windows
system service (`http.sys`, "System", PID 4) that cannot simply be stopped. If you
want to try it: `npm run prod:init -- --port 80 --force`, then `start-event.cmd`.
If the port is busy the start script names the holder and tells you to use 8080.

## Updating configuration later

- Change the admin-allowed IPs or port by editing `.env` (`ADMIN_ALLOWED_IPS`,
  `WEB_PORT`) and restarting, or re-run `prod:init -- ... --force`.
- Reset the organizer password: `npm run admin:reset-password`.
