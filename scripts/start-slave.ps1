# Start Modbus Slave for E2E testing
$ErrorActionPreference = "Stop"

Write-Host "Starting Modbus Slave on port 1502..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$logDir = Join-Path $rootDir ".e2e\modbus\slave"
$logFile = Join-Path $logDir "slave-$(Get-Date -Format 'yyyy-MM-ddTHH-mm-ss').log"

# Ensure log directory exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Start slave and redirect output + error to the same log file
Push-Location $rootDir
try {
    Write-Host "Logs: $logFile" -ForegroundColor Cyan

    # Pre-create the log file so tailing starts immediately
    if (-not (Test-Path $logFile)) {
        New-Item -ItemType File -Path $logFile -Force | Out-Null
    }

    # Use PowerShell redirection to merge stdout/stderr into the same file
    $command = "node ModbusSimulator.js examples/e2e/slave-appconfig.json *> `"$logFile`""
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", $command -WorkingDirectory $rootDir -NoNewWindow

    Get-Content -Path $logFile -Tail 200 -Wait
} finally {
    Pop-Location
}
