$projectDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectDir "logs"
$pidFile = Join-Path $projectDir ".server.pid"

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    exit 0
  }
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$serverProcess = Start-Process `
  -FilePath "node.exe" `
  -ArgumentList "node_modules\tsx\dist\cli.mjs", "server\index.ts" `
  -WorkingDirectory $projectDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir "server-output.log") `
  -RedirectStandardError (Join-Path $logDir "server-error.log") `
  -PassThru

Set-Content -Path $pidFile -Value $serverProcess.Id -Encoding ascii
