<#
.SYNOPSIS
  Stop AI-BOM on Windows for the mode recorded by scripts/setup.ps1 (.aibom-mode).
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

$dbPort = '55432'
if (Test-Path '.env') {
  foreach ($line in Get-Content '.env') {
    if ($line -match '^DB_PORT=(.*)$') { $dbPort = $Matches[1].Trim().Trim('"') }
  }
}

if ($mode -eq 'docker') { docker compose down; exit 0 }

foreach ($name in 'backend', 'frontend') {
  $pidFile = "logs/$name.pid"
  if (Test-Path $pidFile) {
    $procId = Get-Content $pidFile
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($p) { Stop-Process -Id $procId -Force; Write-Host "Stopped $name (PID $procId)" }
    Remove-Item $pidFile -Force
  }
}

switch ($database) {
  'managed' { Push-Location 'backend'; $env:MANAGED_PG_PORT = $dbPort; npm run --silent db:stop; Pop-Location }
  'docker'  { docker compose stop postgres }
}
