$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $projectDir "deployment\automatic-release.zip"
$token = (Get-Content (Join-Path $projectDir ".deploy-token") -Raw).Trim()

New-Item -ItemType Directory -Force -Path (Split-Path $archive) | Out-Null
if (Test-Path $archive) { Remove-Item $archive -Force }

Push-Location $projectDir
try {
  & tar.exe -a -cf $archive src server public scripts prisma/schema.prisma package.json package-lock.json vite.config.js index.html
  if ($LASTEXITCODE -ne 0) { throw "Could not create deployment archive." }
}
finally { Pop-Location }

$headers = @{ Authorization = "Bearer $token" }
$response = Invoke-RestMethod `
  -Uri "http://100.115.133.60:8787/deploy" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/zip" `
  -InFile $archive

if (-not $response.ok) { throw "The server did not accept the deployment." }
Write-Host "Deployment accepted. The update will be live in about one minute."
