# Network checklist — Windows VM on the venue LAN

The platform is LAN-only. Players must be able to reach the VM's IP on the web
port (8080) and the challenge ports (5001-5026). Work through this once during
setup and again on the morning.

## VM networking
- Use **bridged networking** (VMware: "Bridged"; VirtualBox: "Bridged Adapter";
  Hyper-V: an **external** virtual switch). NAT will hide the VM from players.
- Give the VM a **fixed IP** (static, or a DHCP reservation on the router) so the
  URL you print does not change mid-event.
- Confirm the VM and a test laptop are on the **same subnet** and can ping each
  other.

## Windows network profile
- Set the active network to **Private** (Settings → Network → Properties →
  Network profile → Private). The firewall rules are Private-profile only.
  ```powershell
  Get-NetConnectionProfile                       # check NetworkCategory
  Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
  ```

## Firewall
- Run `scripts\windows\open-firewall.ps1 -WebPort 8080` in an **admin** PowerShell.
  It opens TCP 8080 and 5001-5026, Private profile, **LocalSubnet** only, and
  nothing else (no RDP, no SMB).
- Verify: `Get-NetFirewallRule -DisplayName 'Cydemic CTF*'`.
- `npm run preflight` reports whether the rules are present.

## Power: no sleep, no hibernate
- Keep the VM awake for the whole event:
  ```powershell
  powercfg /change standby-timeout-ac 0
  powercfg /change monitor-timeout-ac 0
  powercfg /change disk-timeout-ac 0
  powercfg /hibernate off
  ```

## Windows Update
- Pause updates for the event window (Settings → Windows Update → Pause updates)
  so a reboot does not interrupt play.

## Venue network gotchas
- Some venue Wi-Fi uses **client isolation** (AP isolation), which blocks
  device-to-device traffic — players then cannot reach the VM. Ask the venue to
  disable it for your SSID, or test it: from a laptop, open `http://<vm-ip>:8080`.
- Captive portals, VLANs and guest networks can also isolate clients.

## Backup plan: your own router
- Bring a small travel/Wi-Fi router. Put the VM host and all player laptops on
  **your** router's network (no client isolation), give the VM a reservation, and
  use that IP. This removes any dependence on the venue network.

## Quick reachability test
From a player laptop:
```powershell
Test-NetConnection <vm-ip> -Port 8080      # TcpTestSucceeded : True
```
Then open `http://<vm-ip>:8080` in a browser.
