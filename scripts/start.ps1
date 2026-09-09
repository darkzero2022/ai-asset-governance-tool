<#
.SYNOPSIS
  Start AI-BOM on Windows for the mode recorded by scripts/setup.ps1 (.aibom-mode).
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if (-not (Test-Path '.aibom-mode')) { Write-Error 'Setup has not been run. Run scripts/setup.ps1 first.'; exit 1 }

$mode = 'docker'; $database = 'docker'
foreach ($line in Get-Content '.aibom-mode') {
  if ($line -match '^MODE=(.*)$') { $mode = $Matches[1] }
  if ($line -match '^DATABASE=(.*)$') { $database = $Matches[1] }
}
if (Test-Path '.env') {
  foreach ($line in Get-Content '.env') {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $i = $line.IndexOf('='); Set-Item -Path ("Env:" + $line.Substring(0, $i).Trim()) -Value $line.Substring($i + 1).Trim().Trim('"')
  }
}
$appPort = $env:PORT; if (-not $appPort) { $appPort = '4000' }

if ($mode -eq 'docker') {
  docker compose up -d
  Write-Host "App:    http://localhost:$appPort"
  Write-Host "Health: http://localhost:$appPort/health"
  exit 0
}

New-Item -ItemType Directory -Force -Path 'logs' | Out-Null
switch ($database) {
  'managed' { Push-Location 'backend'; npm run --silent db:start; Pop-Location }
  'docker'  { docker compose up -d postgres }
}

function Start-DevProcess([string] $name, [string] $dir, [string[]] $cmdArgs) {
  $pidFile = "logs/$name.pid"
  if (Test-Path $pidFile) {
    $existing = Get-Content $pidFile
    if (Get-Process -Id $existing -ErrorAction SilentlyContinue) { Write-Host "$name already running (PID $existing)"; return }
  }
  $p = Start-Process -FilePath 'npm.cmd' -ArgumentList $cmdArgs -WorkingDirectory (Join-Path $RootDir $dir) `
        -RedirectStandardOutput "logs/$name.log" -RedirectStandardError "logs/$name.err.log" -WindowStyle Hidden -PassThru
  Set-Content -Path $pidFile -Value $p.Id
  Write-Host "Started $name (PID $($p.Id))"
}

Start-DevProcess 'backend' 'backend' @('run', 'dev')
Start-DevProcess 'frontend' 'frontend' @('run', 'dev', '--', '--host', '127.0.0.1')

for ($i = 0; $i -lt 30; $i++) {
  try {
    if ((Invoke-WebRequest -UseBasicParsing "http://localhost:$appPort/health" -TimeoutSec 2).StatusCode -eq 200) {
      Write-Host 'Frontend: http://localhost:5173'
      Write-Host "Backend:  http://localhost:$appPort/health"
      exit 0
    }
  } catch { Start-Sleep -Seconds 1 }
}
Write-Error 'Services started, but backend health did not respond within 30 seconds. See logs/backend.log.'
exit 1
