$ErrorActionPreference = 'Stop'

$mariadbDir = Get-ChildItem -Path 'C:\Program Files' -Filter 'MariaDB*' -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (!$mariadbDir) { throw 'MariaDB Server is not installed in C:\Program Files.' }

$serverBinary = Join-Path $mariadbDir.FullName 'bin\mariadbd.exe'
$installerBinary = Join-Path $mariadbDir.FullName 'bin\mariadb-install-db.exe'
$clientBinary = Join-Path $mariadbDir.FullName 'bin\mariadb.exe'
$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $projectRoot '.env'
$databaseRoot = Join-Path $env:LOCALAPPDATA 'CSC-MRDU-MariaDB'
$dataDirectory = Join-Path $databaseRoot 'data'
$logPath = Join-Path $databaseRoot 'mariadbd.log'

if (!(Test-Path -LiteralPath $environmentPath)) { throw 'Missing .env. Run npm run setup:local-env first.' }
if (!(Test-Path -LiteralPath $serverBinary)) { throw "MariaDB server binary not found at $serverBinary" }

$passwordLine = Get-Content -LiteralPath $environmentPath | Where-Object { $_ -match '^LOCAL_DB_PASSWORD=' } | Select-Object -First 1
if (!$passwordLine) { throw 'Missing LOCAL_DB_PASSWORD. Run npm run db:local:start once, then re-run this command.' }
$applicationPassword = ($passwordLine -replace '^LOCAL_DB_PASSWORD="?', '' -replace '"?$', '')

function Test-DatabaseListening {
  return [bool](Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue)
}

if (!(Test-Path -LiteralPath (Join-Path $dataDirectory 'mysql'))) {
  New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
  $rootBytes = New-Object byte[] 36
  $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $randomGenerator.GetBytes($rootBytes)
  $randomGenerator.Dispose()
  $rootPassword = [Convert]::ToBase64String($rootBytes) -replace '[^A-Za-z0-9_-]', ''
  & $installerBinary --datadir=$dataDirectory --password=$rootPassword --port=3306 --silent
  if ($LASTEXITCODE -ne 0) { throw 'MariaDB initialization failed.' }

  Start-Process -FilePath $serverBinary -ArgumentList @("--datadir=$dataDirectory", '--port=3306', '--bind-address=127.0.0.1', "--log-error=$logPath") -WindowStyle Hidden
  $ready = $false
  foreach ($attempt in 1..40) {
    if (Test-DatabaseListening) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (!$ready) { throw "MariaDB did not start. See $logPath" }

  $provisioningSql = "CREATE DATABASE IF NOT EXISTS cyber_security_club CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'club_portal'@'%' IDENTIFIED BY '$applicationPassword'; ALTER USER 'club_portal'@'%' IDENTIFIED BY '$applicationPassword'; GRANT ALL PRIVILEGES ON cyber_security_club.* TO 'club_portal'@'%'; FLUSH PRIVILEGES;"
  & $clientBinary --protocol=TCP --host=127.0.0.1 --port=3306 --user=root "--password=$rootPassword" --execute=$provisioningSql
  if ($LASTEXITCODE -ne 0) { throw 'MariaDB application-user provisioning failed.' }
} elseif (!(Test-DatabaseListening)) {
  Start-Process -FilePath $serverBinary -ArgumentList @("--datadir=$dataDirectory", '--port=3306', '--bind-address=127.0.0.1', "--log-error=$logPath") -WindowStyle Hidden
  foreach ($attempt in 1..40) {
    if (Test-DatabaseListening) { break }
    Start-Sleep -Milliseconds 500
  }
}

if (!(Test-DatabaseListening)) { throw "MariaDB is not listening on port 3306. See $logPath" }
Write-Output 'Local MariaDB is ready on 127.0.0.1:3306.'
