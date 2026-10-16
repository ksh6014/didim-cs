$scriptDir = $PSScriptRoot
& (Join-Path $scriptDir "start-production.ps1")
& (Join-Path $scriptDir "start-deploy-agent.ps1")
