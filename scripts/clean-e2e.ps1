# Clean E2E environment (logs and data)
$ErrorActionPreference = "Stop"

Write-Host "Cleaning E2E environment..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$e2eDir = Join-Path $rootDir ".e2e"

if (Test-Path $e2eDir) {
    Write-Host "Removing logs and data from: $e2eDir" -ForegroundColor Cyan
    
    # Remove logs but keep directory structure
    Get-ChildItem -Path $e2eDir -Include *.log -Recurse | Remove-Item -Force
    Write-Host "  - Removed log files" -ForegroundColor Green
    
    # Remove MQTT data
    $mqttDataDir = Join-Path $e2eDir "mqtt"
    if (Test-Path $mqttDataDir) {
        Get-ChildItem -Path $mqttDataDir -Recurse | Remove-Item -Force -Recurse
        Write-Host "  - Cleaned MQTT data" -ForegroundColor Green
    }
    
    # Remove Modbus logs
    $modbusDir = Join-Path $e2eDir "modbus"
    if (Test-Path $modbusDir) {
        Get-ChildItem -Path $modbusDir -Include *.log -Recurse | Remove-Item -Force
        Write-Host "  - Removed Modbus logs" -ForegroundColor Green
    }
    
    Write-Host "E2E environment cleaned successfully!" -ForegroundColor Green
} else {
    Write-Host "No E2E environment found to clean." -ForegroundColor Yellow
}
