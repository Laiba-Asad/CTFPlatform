<#
.SYNOPSIS
  Remove exactly the "Cydemic CTF" inbound firewall rules created by
  open-firewall.ps1. Run in an ADMINISTRATOR PowerShell. Touches nothing else.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\windows\close-firewall.ps1
#>
$ErrorActionPreference = 'Stop'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Error "Run this in an administrator PowerShell (right-click > Run as administrator)."
  exit 1
}

$rules = Get-NetFirewallRule -DisplayName 'Cydemic CTF - *' -ErrorAction SilentlyContinue
if (-not $rules) {
  Write-Host "No 'Cydemic CTF' firewall rules found. Nothing to remove."
  exit 0
}

$removed = 0
foreach ($r in $rules) {
  Remove-NetFirewallRule -Name $r.Name
  Write-Host "  removed $($r.DisplayName)"
  $removed++
}
Write-Host ""
Write-Host "Removed $removed Cydemic CTF firewall rule(s). No other rules were touched."
