$ErrorActionPreference = 'Stop'
$configFile = Join-Path $PSScriptRoot 'config.json'
$config = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
$agentFile = Join-Path $PSScriptRoot 'agent\agent.mjs'
$pidFile = Join-Path $PSScriptRoot 'agent.pid'
if (Test-Path -LiteralPath $pidFile) {
    $previousPid = 0
    if ([int]::TryParse((Get-Content -LiteralPath $pidFile -Raw).Trim(), [ref]$previousPid)) {
        $previous = Get-CimInstance Win32_Process -Filter "ProcessId = $previousPid" -ErrorAction SilentlyContinue
        if ($previous -and $previous.Name -eq 'node.exe' -and $previous.CommandLine -and $previous.CommandLine.IndexOf($agentFile, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Write-Output 'Git deployment agent is already running.'
            exit 0
        }
    }
}
$agentProcess = Start-Process -FilePath $config.nodePath `
    -ArgumentList ('"{0}" --config "{1}"' -f $agentFile, $configFile) `
    -WorkingDirectory $PSScriptRoot -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $PSScriptRoot 'stdout.log') `
    -RedirectStandardError (Join-Path $PSScriptRoot 'stderr.log') -PassThru
Set-Content -LiteralPath $pidFile -Value $agentProcess.Id -Encoding ascii
Write-Output "Git deployment agent started: $($agentProcess.Id)"
