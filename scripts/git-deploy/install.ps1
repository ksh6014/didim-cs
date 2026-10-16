param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeRoot,
    [ValidateRange(30, 3600)][int]$PollSeconds = 60,
    [switch]$Start
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceRoot).Path.TrimEnd('\')
$runtime = (Resolve-Path -LiteralPath $RuntimeRoot).Path.TrimEnd('\')
if ($source -eq $runtime) { throw 'Source and runtime folders must differ.' }
foreach ($folder in @($source, $runtime)) {
    if ((Get-Item -LiteralPath $folder).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Project junctions are not supported.' }
}
Get-Item -LiteralPath (Join-Path $runtime 'server\index.ts') -ErrorAction Stop | Out-Null
$node = (Get-Command node.exe -ErrorAction Stop).Source
$git = (Get-Command git.exe -ErrorAction Stop).Source
$tar = (Get-Command tar.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$npmCli = Join-Path (Split-Path -Parent $npm) 'node_modules\npm\bin\npm-cli.js'
Get-Item -LiteralPath $npmCli -ErrorAction Stop | Out-Null
$control = Join-Path $runtime 'deployment\git-auto'
$buildRoot = Join-Path $source 'deployment\git-releases'
$startupFile = Join-Path ([Environment]::GetFolderPath('Startup')) 'DIDIM CS Git Auto Deploy.cmd'
if ((Test-Path -LiteralPath (Join-Path $control 'state.json')) -or (Test-Path -LiteralPath $startupFile)) { throw 'An installation already exists; state/startup were preserved. See the upgrade instructions.' }
foreach ($folder in @((Join-Path $runtime 'deployment'), $control, (Join-Path $control 'agent'), (Join-Path $source 'deployment'), $buildRoot)) {
    if ((Test-Path -LiteralPath $folder) -and ((Get-Item -LiteralPath $folder).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Control/build folder junctions are not supported.' }
}
New-Item -ItemType Directory -Path (Join-Path $control 'agent') -Force | Out-Null
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
foreach ($name in @('core.mjs', 'agent.mjs')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $control "agent\$name") -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-agent.ps1') -Destination (Join-Path $control 'start-agent.ps1') -Force
$configFile = Join-Path $control 'config.json'
[ordered]@{
    sourceRoot = $source
    runtimeRoot = $runtime
    controlRoot = $control
    buildRoot = $buildRoot
    gitPath = $git
    npmCli = $npmCli
    tarPath = $tar
    nodePath = $node
    healthUrl = 'http://127.0.0.1:4000/'
    pollSeconds = $PollSeconds
} | ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding UTF8
& $node (Join-Path $control 'agent\agent.mjs') --config $configFile --initialize
if ($LASTEXITCODE -ne 0) { throw 'Initialization failed. No startup entry was installed. Inspect the error; do not bypass baseline verification.' }
$startupContent = "@echo off`r`npowershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$control\start-agent.ps1`"`r`n"
[IO.File]::WriteAllText($startupFile, $startupContent, [Text.UTF8Encoding]::new($false))
Write-Output "Installed. Control folder: $control"
Write-Output 'Startup runs when this Windows user signs in; no reboot is needed.'
if ($Start) { & (Join-Path $control 'start-agent.ps1') }
