$projectDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectDir "logs"
$pidFile = Join-Path $projectDir ".deploy-agent.pid"

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    exit 0
  }
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$agentProcess = Start-Process `
  -FilePath "node.exe" `
  -ArgumentList "scripts\deploy-agent.mjs" `
  -WorkingDirectory $projectDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir "deploy-output.log") `
  -RedirectStandardError (Join-Path $logDir "deploy-error.log") `
  -PassThru

Set-Content -Path $pidFile -Value $agentProcess.Id -Encoding ascii
