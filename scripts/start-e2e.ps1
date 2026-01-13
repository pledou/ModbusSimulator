# Start full E2E environment
$ErrorActionPreference = "Stop"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Starting E2E Test Environment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Clean previous run
Write-Host "[1/5] Cleaning previous E2E data..." -ForegroundColor Yellow
& "$scriptDir\clean-e2e.ps1"
Write-Host ""

# Start MQTT Broker
Write-Host "[2/5] Starting MQTT Broker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$scriptDir\start-mqtt.ps1") -WindowStyle Normal
Start-Sleep -Seconds 2
Write-Host "  [OK] MQTT Broker started on port 1883" -ForegroundColor Green
Write-Host ""

# Start Slave
Write-Host "[3/5] Starting Modbus Slave..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$scriptDir\start-slave.ps1") -WindowStyle Normal
Start-Sleep -Seconds 3
Write-Host "  [OK] Modbus Slave started on port 1502" -ForegroundColor Green
Write-Host ""

# Start Master
Write-Host "[4/5] Starting Modbus Master..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$scriptDir\start-master.ps1") -WindowStyle Normal
Start-Sleep -Seconds 2
Write-Host "  [OK] Modbus Master started (connecting to slave)" -ForegroundColor Green
Write-Host ""

# Start Hodd UI
Write-Host "[5/5] Starting Hodd UI..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$scriptDir\start-hodd.ps1") -WindowStyle Normal
Start-Sleep -Seconds 1
Write-Host "  [OK] Hodd UI started at http://localhost:8080" -ForegroundColor Green
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  E2E Environment Ready!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services running:" -ForegroundColor White
Write-Host "  • MQTT Broker:  mqtt://localhost:1883" -ForegroundColor Cyan
Write-Host "  • Modbus Slave: tcp://localhost:1502" -ForegroundColor Cyan
Write-Host "  • Modbus Master: Connected to slave" -ForegroundColor Cyan
Write-Host "  • Hodd UI:      http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop all services, run: .\scripts\stop-all.ps1" -ForegroundColor Yellow
Write-Host "To run tests, use: npm run test:e2e" -ForegroundColor Yellow
Write-Host ""
