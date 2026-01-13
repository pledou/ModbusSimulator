# Start Modbus Master for E2E testing
$ErrorActionPreference = "Stop"

Write-Host "Starting Modbus Master (connects to slave on port 1502)..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$logDir = Join-Path $rootDir ".e2e\modbus\master"
$logFile = Join-Path $logDir "master-$(Get-Date -Format 'yyyy-MM-ddTHH-mm-ss').log"

# Ensure log directory exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Wait for slave to be ready (simple check)
Write-Host "Waiting for slave to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Start master and redirect output to log
Push-Location $rootDir
try {
    Write-Host "Logs: $logFile" -ForegroundColor Cyan
    # Use Start-Process to run node and redirect stdout/stderr to the log file
    $startInfo = @{ 
        FilePath = 'node'
        ArgumentList = @('ModbusSimulator.js', 'examples/e2e/master-appconfig.json')
        NoNewWindow = $true
        Wait = $true
        RedirectStandardOutput = $logFile
        RedirectStandardError = $logFile
    }
    Start-Process @startInfo
    # Stream last lines of log to console so user sees output
    Get-Content -Path $logFile -Tail 200 -Wait
} finally {
    Pop-Location
}
