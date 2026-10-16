$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$startupDir = [Environment]::GetFolderPath("Startup")
$startupFile = Join-Path $startupDir "CS Manager Server.cmd"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js가 설치되어 있지 않습니다. Node.js LTS를 먼저 설치하세요."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm을 찾을 수 없습니다. Node.js LTS 설치 상태를 확인하세요."
}

Push-Location $projectDir
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci 실행에 실패했습니다." }

  npm run build
  if ($LASTEXITCODE -ne 0) { throw "운영 화면 빌드에 실패했습니다." }
}
finally {
  Pop-Location
}

$startupContents = @"
@echo off
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$projectDir\scripts\start-all.ps1"
"@

[System.IO.File]::WriteAllText($startupFile, $startupContents, [System.Text.UTF8Encoding]::new($false))

& (Join-Path $PSScriptRoot "start-all.ps1")

Write-Host "CS Manager 서버 설치가 완료되었습니다."
Write-Host "이 PC에서는 http://localhost:4000 으로 확인하세요."
Write-Host "외부 공개는 다음 명령으로 설정합니다: tailscale serve --bg 4000"
