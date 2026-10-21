<#
.SYNOPSIS
  Open the Windows firewall for the Cydemic CTF platform, on the Private profile
  and LocalSubnet only. Run in an ADMINISTRATOR PowerShell.

.DESCRIPTION
  Creates inbound allow rules named "Cydemic CTF - <port>" for:
    - the player web port (default 8080, or -WebPort)
    - the challenge service ports 5001-5026
  All rules are TCP, Private profile only, RemoteAddress = LocalSubnet.
  It opens nothing else (no RDP, no SMB). Use close-firewall.ps1 to remove them.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\windows\open-firewall.ps1 -WebPort 8080
#>
param(
  [int]$WebPort = 8080
)

$ErrorActionPreference = 'Stop'
$prefix = 'Cydemic CTF'

# Require elevation.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Error "Run this in an administrator PowerShell (right-click > Run as administrator)."
  exit 1
}

$ports = @($WebPort) + (5001..5026)
$ports = $ports | Sort-Object -Unique
$created = 0
$kept = 0

foreach ($p in $ports) {
  $name = "$prefix - $p"
  $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($existing) {
    $kept++
    continue
  }
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $p -Profile Private -RemoteAddress LocalSubnet | Out-Null
  $created++
  Write-Host "  opened TCP $p (Private, LocalSubnet)"
}

Write-Host ""
Write-Host "Cydemic CTF firewall: $created rule(s) created, $kept already present."
Write-Host "Player web port: $WebPort. Challenge ports: 5001-5026. TCP, Private profile, LocalSubnet only."
Write-Host "Nothing else was opened. Remove with: scripts\windows\close-firewall.ps1"
