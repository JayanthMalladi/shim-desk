# wsl-agent-setup.ps1 — unblock Switch Console "Add host" on Windows (issue #1472).
# Console's host-onboarding authenticates via the Windows OpenSSH agent (a named
# pipe) but never sets SSH_AUTH_SOCK on win32, so it reports "SSH agent socket
# not found". This finds a *user-reachable* agent pipe, loads our key, and
# persists SSH_AUTH_SOCK so a restarted Console inherits it.
#
# Run it in a normal PowerShell (your GUI session), then fully quit + reopen
# Switch Console and retry Settings -> Remote hosts -> Add host (wsl-switch).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\shim-desk\docs\wsl-agent-setup.ps1

$ErrorActionPreference = 'Continue'
$key = Join-Path $env:USERPROFILE '.ssh\id_ed25519'
Write-Host "Key: $key  (exists: $(Test-Path $key))"

# Candidate Windows OpenSSH agent pipes (user-session first).
$candidates = @('\\.\pipe\openssh-agent','\\.\pipe\openssh-ssh-agent')
$reachable  = $null

# 1) Which candidate pipe can we actually talk to via the agent protocol?
foreach ($c in $candidates) {
    $env:SSH_AUTH_SOCK = $c
    & ssh-add -l 2>&1 | Out-Host
    if ($LASTEXITCODE -eq 0) { $reachable = $c; break }
}

# 2) None reachable -> start a user-session agent; ssh-agent prints the pipe.
if (-not $reachable) {
    Write-Host "`No reachable agent pipe. Starting a user-session ssh-agent..."
    $out = (& ssh-agent 2>$null) -join "`n"
    Write-Host $out
    if ($out -match 'SSH_AUTH_SOCK="([^"]+)"') { $reachable = $Matches[1] }
}

if ($reachable) {
    $env:SSH_AUTH_SOCK = $reachable
    Write-Host "`Using agent pipe: $reachable"
    & ssh-add $key 2>&1 | Out-Host
    Write-Host "--- keys in agent (ssh-add -l) ---"
    & ssh-add -l 2>&1 | Out-Host
    & setx SSH_AUTH_SOCK $reachable 2>&1 | Out-Host
    Write-Host "`DONE. Now: fully QUIT Switch Console (tray -> Quit), reopen it,`nthen retry  Settings -> Remote hosts -> Add host  (host: wsl-switch)."
} else {
    Write-Host "Could not reach or start an agent pipe. Fallback: create the two agents BY HAND with Run location = the WSL host (01 section 6.5 table). See docs/DECISIONS.md."
}
