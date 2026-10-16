$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$startupDir = [Environment]::GetFolderPath("Startup")
$startupFile = Join-Path $startupDir "CS Manager Server.cmd"

$startupContents = @"
@echo off
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$projectDir\scripts\start-all.ps1"
"@
[System.IO.File]::WriteAllText($startupFile, $startupContents, [System.Text.UTF8Encoding]::new($false))

$listener = netstat.exe -ano | Select-String -Pattern ':4000\s+.*LISTENING\s+(\d+)\s*$' | Select-Object -First 1
if ($listener -and $listener.Matches.Count -gt 0) {
  $existingServerPid = [int]$listener.Matches[0].Groups[1].Value
  Stop-Process -Id $existingServerPid -Force -ErrorAction SilentlyContinue
}

Remove-Item (Join-Path $projectDir ".server.pid") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $projectDir ".deploy-agent.pid") -Force -ErrorAction SilentlyContinue

& (Join-Path $PSScriptRoot "start-all.ps1")
Start-Sleep -Seconds 3

try {
  $health = Invoke-RestMethod -TimeoutSec 5 "http://100.115.133.60:8787/health"
  if (-not $health.ok) { throw "Deploy agent health response is invalid." }
  Write-Host "Automatic deployment agent installed successfully."
}
catch {
  Write-Host "Deploy agent failed to start. Check logs\deploy-error.log."
  throw
}
