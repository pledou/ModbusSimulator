# Stop all E2E processes
$ErrorActionPreference = "Stop"

Write-Host "Stopping all E2E processes..." -ForegroundColor Yellow

# Stop Node processes with specific patterns
$patterns = @(
    "mqtt-broker.js",
    "hodd-server.js",
    "ModbusSimulator.js"
)

$stoppedAny = $false

foreach ($pattern in $patterns) {
    # Use WMI to get command line information
    $processes = Get-WmiObject Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*$pattern*"
    }
    
    if ($processes) {
        foreach ($proc in $processes) {
            Write-Host "Stopping process: $($proc.ProcessId) - $pattern" -ForegroundColor Cyan
            Stop-Process -Id $proc.ProcessId -Force
            $stoppedAny = $true
        }
    }
}

if ($stoppedAny) {
    Write-Host "All E2E processes stopped!" -ForegroundColor Green
} else {
    Write-Host "No E2E processes found running." -ForegroundColor Yellow
}
