<#
.SYNOPSIS
  Windows-native setup for AI-BOM (equivalent to scripts/setup.sh).

.DESCRIPTION
  Checks for and (optionally) installs system dependencies via winget, writes the
  root .env (ports included), installs npm packages, runs Prisma migrations,
  seeds reference data, and creates the initial admin account.

  Run from PowerShell (Windows PowerShell 5.1 or PowerShell 7+):
      powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1            # interactive
      powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Yes       # non-interactive defaults
      ... -Mode docker -Data demo -Port 4200 -DbPort 55440 -AdminEmail me@corp.com -AdminPassword 'a-strong-passphrase' -Yes

.NOTES
  Dependencies: Node 22+ and npm (local mode); Docker Desktop + the compose plugin
  (docker mode / -Database docker). openssl is NOT required on Windows - secrets
  use .NET's RNG.
#>
[CmdletBinding()]
param(
  [ValidateSet('local', 'docker')]              [string] $Mode,
  [ValidateSet('managed', 'docker', 'url')]     [string] $Database,
  [ValidateSet('empty', 'demo')]                [string] $Data,
  [int] $Port,
  [int] $DbPort,
  [int] $FrontendPort,
  [string] $AdminEmail,
  [string] $AdminName,
  [string] $AdminPassword,
  [switch] $AdminDefer,
  [switch] $InstallDeps,
  [switch] $SkipDeps,
  [switch] $Yes
)

$ErrorActionPreference = 'Stop'
$NodeMinMajor = 22
$MinPasswordLen = 12
$RootDir = Split-Path -Parent $PSScriptRoot

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
function Have([string] $cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Read-Choice([string] $prompt, [string] $default) {
  if ($Yes) { return $default }
  $answer = Read-Host "$prompt [$default]"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $default }
  return $answer
}

function Read-AdminPassword {
  if ($Yes) { return '' }
  while ($true) {
    $s1 = Read-Host "Admin password (>= $MinPasswordLen chars, not a common password)" -AsSecureString
    $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
    if ([string]::IsNullOrEmpty($p1)) { Write-Host '  A password is required. (Re-run with -AdminDefer to set it in the app instead.)'; continue }
    if ($p1.Length -lt $MinPasswordLen) { Write-Host "  Password must be at least $MinPasswordLen characters."; continue }
    $s2 = Read-Host 'Confirm admin password' -AsSecureString
    $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
    if ($p1 -ceq $p2) { return $p1 }
    Write-Host '  Passwords did not match, try again.'
  }
}

function New-RandomHex([int] $bytes = 32) {
  $buf = New-Object 'byte[]' $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
}
function New-RandomPassword {
  $buf = New-Object 'byte[]' 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  ([Convert]::ToBase64String($buf) -replace '[/+=]', '').Substring(0, 24)
}

function Get-EnvValue([string] $file, [string] $key) {
  if (-not (Test-Path $file)) { return $null }
  foreach ($line in Get-Content $file) {
    if ($line -match "^$([regex]::Escape($key))=(.*)$") { return $Matches[1] }
  }
  return $null
}
function Write-TextFile([string] $file, [string[]] $lines) {
  # UTF-8 without BOM - a BOM on line 1 breaks the first key for both the .env
  # parser here and scripts/*.sh reading the same file.
  $full = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $file))
  [System.IO.File]::WriteAllText($full, ($lines -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
}
function Set-EnvValue([string] $file, [string] $key, [string] $value) {
  $lines = @()
  if (Test-Path $file) { $lines = @(Get-Content $file) }
  $out = @()
  $found = $false
  foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($key))=") { $out += "$key=$value"; $found = $true }
    else { $out += $line }
  }
  if (-not $found) { $out += "$key=$value" }
  Write-TextFile $file $out
}

function Test-PortInUse([int] $port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $port)
    $c.Close()
    return $true
  } catch { return $false }
}

function Resolve-Port([int] $fromParam, [string] $envKey, [int] $default, [string] $prompt, [bool] $ask) {
  if ($fromParam) { $value = $fromParam }
  else {
    $existing = Get-EnvValue '.env' $envKey
    $value = if ($existing) { [int]$existing } else { $default }
    if ($ask -and -not $Yes) { $value = [int](Read-Choice $prompt "$value") }
  }
  if ($value -lt 1024 -or $value -gt 65535) { throw "Port $value must be an integer 1024-65535." }
  return $value
}

function Get-NodeMajor {
  if (-not (Have 'node')) { return 0 }
  try {
    $v = (& node --version).Trim().TrimStart('v')
    return [int]($v.Split('.')[0])
  } catch { return 0 }
}

function Install-WingetPackage([string] $id, [string] $label) {
  if (-not (Have 'winget')) {
    throw "winget is not available. Install $label manually, then re-run."
  }
  Write-Host "  Installing $label ($id) via winget ..."
  & winget install --id $id --exact --accept-source-agreements --accept-package-agreements --silent
  if ($LASTEXITCODE -ne 0) { throw "winget failed to install $label. Install it manually and re-run." }
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

function Confirm-Install([string[]] $items) {
  if ($InstallDeps -or $Yes) { return $true }
  Write-Host ''
  Write-Host ("Missing dependencies: " + ($items -join ', '))
  $answer = Read-Host 'Attempt to install them now with winget? [y/N]'
  return ($answer -match '^(y|yes)$')
}

function Assert-Dependencies {
  if ($SkipDeps) { return }

  $needNode   = ($Mode -eq 'local')
  $needDocker = ($Mode -eq 'docker' -or $Database -eq 'docker')
  $want = @()
  if ($needNode) { $want += 'node'; $want += 'npm' }
  if ($needDocker) { $want += 'docker' }
  Write-Host ("Platform: Windows - package manager: " + $(if (Have 'winget') { 'winget' } else { 'none' }) + " - install mode: $Mode/$Database - checking: " + ($want -join ', '))

  $missing = @()
  if ($needNode) {
    if (-not (Have 'node')) { $missing += 'node' }
    elseif ((Get-NodeMajor) -lt $NodeMinMajor) {
      Write-Host "Node $(& node -v) is too old - this project needs Node $NodeMinMajor+."
      $missing += 'node'
    }
    if ((Have 'node') -and -not (Have 'npm')) { $missing += 'npm' }
  }
  if ($needDocker -and -not (Have 'docker')) { $missing += 'docker' }

  if ($missing.Count -eq 0) {
    if ($needDocker) {
      & docker compose version *> $null
      if ($LASTEXITCODE -ne 0) { throw "The 'docker compose' plugin is required. Update Docker Desktop." }
    }
    return
  }

  if (-not (Confirm-Install $missing)) {
    Write-Host ''
    Write-Host 'Install them by hand, then re-run scripts/setup.ps1:'
    if ($missing -contains 'node' -or $missing -contains 'npm') { Write-Host '  node/npm:  winget install --id OpenJS.NodeJS.LTS' }
    if ($missing -contains 'docker') { Write-Host '  docker:    winget install --id Docker.DockerDesktop   (then start Docker Desktop)' }
    exit 1
  }

  if ($missing -contains 'node' -or $missing -contains 'npm') { Install-WingetPackage 'OpenJS.NodeJS.LTS' 'Node.js LTS' }
  if ($missing -contains 'docker') {
    Install-WingetPackage 'Docker.DockerDesktop' 'Docker Desktop'
    Write-Host '  Docker Desktop installed - start it (and complete first-run setup), then re-run this script.'
    exit 1
  }

  if ($needNode -and ((-not (Have 'node')) -or (Get-NodeMajor) -lt $NodeMinMajor)) {
    Write-Host ''
    Write-Host 'Node still missing/old after install. Open a NEW PowerShell window (so PATH refreshes) and re-run scripts/setup.ps1.'
    exit 1
  }
  Write-Host 'All dependencies present.'
  Write-Host ''
}

# --------------------------------------------------------------------------
# resolve options
# --------------------------------------------------------------------------
Set-Location $RootDir
Write-Host '-- Environment --------------------------------------------------'
if (-not $Mode) { $Mode = Read-Choice 'Install mode: local or docker' 'local' }
if ($Mode -notin @('local', 'docker')) { throw '-Mode must be local or docker' }

if (-not $Database) {
  if ($Mode -eq 'docker') { $Database = 'docker' }
  elseif ($Yes) { $Database = 'managed' }
  else { $Database = Read-Choice 'Database: managed (bundled, no Docker), docker, or url' 'managed' }
}
if ($Database -notin @('managed', 'docker', 'url')) { throw '-Database must be managed, docker, or url' }
if ($Mode -eq 'docker' -and $Database -ne 'docker') { throw '-Mode docker requires -Database docker' }

if (-not $Data) { if ($Yes) { $Data = 'empty' } else { $Data = Read-Choice 'Data mode: empty or demo' 'empty' } }
if ($Data -notin @('empty', 'demo')) { throw '-Data must be empty or demo' }

Write-Host '-- Ports --------------------------------------------------------'
$appPort      = Resolve-Port $Port 'PORT' 4000 'API + web app port' $true
$dbPortValue  = Resolve-Port $DbPort 'DB_PORT' 55432 'PostgreSQL host port' ($Database -ne 'url')
$frontendPort = Resolve-Port $FrontendPort 'FRONTEND_PORT' 5173 'Vite dev-server port' ($Mode -eq 'local')
$portSet = @($appPort, $dbPortValue, $frontendPort)
if (($portSet | Select-Object -Unique).Count -ne $portSet.Count) { throw 'The app, database, and frontend ports must all be different.' }

Write-Host '-- Admin account ----------------------------------------------'
if (-not $AdminEmail) { if ($Yes) { $AdminEmail = 'admin@example.com' } else { $AdminEmail = Read-Choice 'Admin email (this is the login)' 'admin@example.com' } }
if ($AdminEmail -notmatch '^[^@]+@[^@]+\.[^@]+$') { throw '-AdminEmail must look like an email address' }

if (-not $AdminName) { if ($Yes) { $AdminName = 'Admin User' } else { $AdminName = Read-Choice 'Admin display name' 'Admin User' } }

if (-not $AdminPassword -and -not $Yes -and -not $AdminDefer) { $AdminPassword = Read-AdminPassword }
if ($AdminPassword -and $AdminPassword.Length -lt $MinPasswordLen) { throw "Admin password must be at least $MinPasswordLen characters." }

Write-Host '-- Dependencies ----------------------------------------------'
Assert-Dependencies

# --------------------------------------------------------------------------
# preflight
# --------------------------------------------------------------------------
$errors = 0
if ($Mode -eq 'local' -and (Get-NodeMajor) -lt $NodeMinMajor) {
  Write-Host "Node $NodeMinMajor+ is required for local mode."; $errors = 1
}
if (Test-PortInUse $appPort) { Write-Host "Port $appPort is in use - pick another with -Port."; $errors = 1 }
if ($Mode -eq 'local' -and (Test-PortInUse $frontendPort)) { Write-Host "Port $frontendPort (frontend dev server) is in use - pick another with -FrontendPort."; $errors = 1 }
if ($Database -ne 'url' -and -not (Test-Path 'data/pg') -and (Test-PortInUse $dbPortValue)) {
  Write-Host "Port $dbPortValue is in use - pick another with -DbPort or use -Database url."; $errors = 1
}
if ($errors) { Write-Host 'Preflight checks failed. Nothing was changed.'; exit 1 }

# --------------------------------------------------------------------------
# root .env - the single source of truth
# --------------------------------------------------------------------------
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env'; Write-Host 'Created .env from .env.example' }

Set-EnvValue '.env' 'DB_MODE' $Database
if (-not (Get-EnvValue '.env' 'JWT_SECRET'))       { Set-EnvValue '.env' 'JWT_SECRET' (New-RandomHex 32) }
if (-not (Get-EnvValue '.env' 'POSTGRES_PASSWORD')) { Set-EnvValue '.env' 'POSTGRES_PASSWORD' (New-RandomPassword) }
if (-not (Get-EnvValue '.env' 'POSTGRES_USER'))     { Set-EnvValue '.env' 'POSTGRES_USER' 'aibom' }
if (-not (Get-EnvValue '.env' 'POSTGRES_DB'))       { Set-EnvValue '.env' 'POSTGRES_DB' 'aibom' }
if (-not (Get-EnvValue '.env' 'BIND_HOST'))         { Set-EnvValue '.env' 'BIND_HOST' '127.0.0.1' }

Set-EnvValue '.env' 'PORT' "$appPort"
Set-EnvValue '.env' 'DB_PORT' "$dbPortValue"
Set-EnvValue '.env' 'FRONTEND_PORT' "$frontendPort"

$pgUser = Get-EnvValue '.env' 'POSTGRES_USER'
$pgPass = Get-EnvValue '.env' 'POSTGRES_PASSWORD'
$pgDb   = Get-EnvValue '.env' 'POSTGRES_DB'

if ($Database -eq 'url') {
  if (-not (Get-EnvValue '.env' 'DATABASE_URL')) { throw '-Database url needs DATABASE_URL set in .env. Add it and re-run.' }
} else {
  Set-EnvValue '.env' 'DATABASE_URL' "postgresql://${pgUser}:${pgPass}@127.0.0.1:${dbPortValue}/${pgDb}?schema=public"
}

$appUrlNow = Get-EnvValue '.env' 'APP_URL'
if (-not $appUrlNow -or $appUrlNow -match 'localhost|127\.0\.0\.1') { Set-EnvValue '.env' 'APP_URL' "http://localhost:$appPort" }
$corsNow = Get-EnvValue '.env' 'CORS_ORIGIN'
if (-not $corsNow -or $corsNow -match 'localhost|127\.0\.0\.1') { Set-EnvValue '.env' 'CORS_ORIGIN' "http://localhost:$appPort" }

if ($Mode -eq 'local') {
  foreach ($k in 'DATABASE_URL', 'JWT_SECRET', 'PORT', 'CORS_ORIGIN', 'APP_URL') {
    Set-EnvValue 'backend/.env' $k (Get-EnvValue '.env' $k)
  }
  if ($Database -eq 'managed') { Set-EnvValue 'backend/.env' 'MANAGED_PG_PORT' "$dbPortValue" }
}

# An interactive run has a password by now; -AdminDefer leaves it to the app.
$adminViaWizard = $false
$adminGenerated = $false
if (-not $AdminPassword) {
  if ($AdminDefer) { $adminViaWizard = $true }
  else { $AdminPassword = New-RandomPassword; $adminGenerated = $true }
}

# Load .env into this process so `docker compose` / prisma see it.
foreach ($line in Get-Content '.env') {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $idx = $line.IndexOf('=')
  $name = $line.Substring(0, $idx).Trim()
  $val = $line.Substring($idx + 1).Trim().Trim('"')
  Set-Item -Path "Env:$name" -Value $val
}
$env:ADMIN_EMAIL = $AdminEmail
$env:ADMIN_NAME = $AdminName
if ($AdminPassword) { $env:ADMIN_PASSWORD = $AdminPassword } else { Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue }

# --------------------------------------------------------------------------
# install + migrate + seed
# --------------------------------------------------------------------------
function Invoke-Step([string] $label, [scriptblock] $block) {
  Write-Host "==> $label"
  & $block
  if ($LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE)" }
}

if ($Mode -eq 'docker') {
  Invoke-Step 'docker compose build backend' { docker compose build backend }
  Invoke-Step 'start postgres'               { docker compose up -d postgres }
  Invoke-Step 'prisma migrate deploy'        { docker compose run --rm backend npx prisma migrate deploy }
  Invoke-Step 'seed reference data'          { docker compose run --rm -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD backend npm run prisma:seed:reference }
  if ($Data -eq 'demo') {
    Invoke-Step 'seed demo data'             { docker compose run --rm -e ADMIN_EMAIL -e ADMIN_NAME backend npm run prisma:seed:demo }
  }
} else {
  Invoke-Step 'build @aibom/shared'   { Push-Location 'packages/shared'; npm install; if ($LASTEXITCODE -eq 0) { npm run build }; Pop-Location }
  Invoke-Step 'install backend'       { Push-Location 'backend'; npm install; if ($LASTEXITCODE -eq 0) { npm run prisma:generate }; Pop-Location }
  Invoke-Step 'install frontend'      { Push-Location 'frontend'; npm install; Pop-Location }

  switch ($Database) {
    'managed' { Invoke-Step 'start bundled PostgreSQL' { Push-Location 'backend'; $env:MANAGED_PG_PORT = "$dbPortValue"; npm run db:start; Pop-Location } }
    'docker'  { Invoke-Step 'start postgres container' { docker compose up -d postgres } }
    'url'     { }
  }

  Invoke-Step 'prisma migrate deploy' { Push-Location 'backend'; npx prisma migrate deploy; Pop-Location }
  Invoke-Step 'seed reference data'   { Push-Location 'backend'; npm run prisma:seed:reference; Pop-Location }
  if ($Data -eq 'demo') {
    Invoke-Step 'seed demo data'      { Push-Location 'backend'; npm run prisma:seed:demo; Pop-Location }
  }
}

Write-TextFile '.aibom-mode' @("MODE=$Mode", "DATABASE=$Database", "DATA=$Data")

$appUrl = Get-EnvValue '.env' 'APP_URL'
Write-Host ''
Write-Host 'Setup complete. Run scripts/start.ps1 to start AI-BOM.'
Write-Host "Mode: $Mode   Database: $Database   Data: $Data"
Write-Host "App:  $appUrl"
if ($Mode -eq 'local') { Write-Host "Dev:  http://localhost:$frontendPort  (Vite dev server via scripts/start.ps1)" }
if ($Database -ne 'url') { Write-Host "DB:   127.0.0.1:$dbPortValue" }
Write-Host 'Config is in .env (generated secrets are gitignored).'
if ($adminViaWizard) {
  Write-Host "Admin account: none seeded - open $appUrl and create it on first visit."
} elseif ($adminGenerated) {
  Write-Host "Admin login: $AdminEmail   (name: $AdminName)"
  Write-Host "Admin password: $AdminPassword   (generated - change it on the Account page)"
} else {
  Write-Host "Admin login: $AdminEmail   (name: $AdminName)"
  Write-Host 'Admin password: the value you supplied.'
}
Write-Host 'To reset the admin password later, re-run:'
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -Mode $Mode -Database $Database -Data $Data -AdminEmail '$AdminEmail' -AdminPassword 'NEW' -Yes"
