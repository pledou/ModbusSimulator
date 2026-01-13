# Start Aedes MQTT Broker for E2E testing
$ErrorActionPreference = "Stop"

Write-Host "Starting Aedes MQTT Broker on port 1883..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Check if node is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Start broker
Push-Location $rootDir
try {
    node "$scriptDir\mqtt-broker.js"
} finally {
    Pop-Location
}
