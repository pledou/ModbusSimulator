# Start Hodd UI server for manual testing
$ErrorActionPreference = "Stop"

Write-Host "Starting Hodd UI server on http://localhost:8080..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

Push-Location $rootDir
try {
    node "$scriptDir\hodd-server.js"
} finally {
    Pop-Location
}
