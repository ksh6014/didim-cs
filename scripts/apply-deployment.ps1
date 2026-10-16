param([Parameter(Mandatory = $true)][string]$Archive)

$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$deploymentDir = Join-Path $projectDir "deployment"
$stageDir = Join-Path $deploymentDir "stage"
$lockFile = Join-Path $deploymentDir "deployment.lock"
$logFile = Join-Path $projectDir "logs\deployment.log"

try {
  if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
  Expand-Archive -Path $Archive -DestinationPath $stageDir -Force

  foreach ($directory in @("src", "server", "public", "scripts")) {
    $source = Join-Path $stageDir $directory
    if (Test-Path $source) { Copy-Item $source $projectDir -Recurse -Force }
  }

  foreach ($file in @("index.html", "package.json", "package-lock.json", "vite.config.js")) {
    $source = Join-Path $stageDir $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $projectDir $file) -Force }
  }

  $schemaSource = Join-Path $stageDir "prisma\schema.prisma"
  if (Test-Path $schemaSource) { Copy-Item $schemaSource (Join-Path $projectDir "prisma\schema.prisma") -Force }

  Push-Location $projectDir
  try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
  }
  finally { Pop-Location }

  $pidFile = Join-Path $projectDir ".server.pid"
  if (Test-Path $pidFile) {
    $serverPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($serverPid) { Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }

  & (Join-Path $PSScriptRoot "start-production.ps1")
  Add-Content $logFile "$(Get-Date -Format s) deployment completed"
}
catch {
  Add-Content $logFile "$(Get-Date -Format s) deployment failed: $($_.Exception.Message)"
  exit 1
}
finally {
  if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
  if (Test-Path $lockFile) { Remove-Item $lockFile -Force }
}
