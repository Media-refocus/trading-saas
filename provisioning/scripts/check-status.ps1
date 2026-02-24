# Trading Bot SaaS - Verificar Estado
# ========================================

param(
    [string]$InstallPath = "C:\TradingBot"
)

$ErrorActionPreference = "Stop"

Write-Host "Verificando estado del Trading Bot..." -ForegroundColor Cyan

# Verificar instalación
$botDir = Join-Path $InstallPath "bot-saas"
$venvPath = Join-Path $InstallPath "venv"

if (-not (Test-Path $botDir)) {
    Write-Host "❌ Bot no instalado. Ejecuta install-windows.ps1 primero" -ForegroundColor Red
    exit 1
}

# Verificar Python
Write-Host "`n🐍 Python:" -ForegroundColor Gray
& $venvPath\Scripts\python.exe --version

# Verificar servicio
Write-Host "`n🔧 Servicio:" -ForegroundColor Gray
$service = Get-Service -Name "TradingBotSaaS" -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "   Estado: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Yellow" })
    Write-Host "   Inicio: $($service.StartType)"
} else {
    Write-Host "   ❌ No instalado como servicio" -ForegroundColor Red
}

# Verificar conexión con SaaS
Write-Host "`n🌐 Conexión con SaaS:" -ForegroundColor Gray

$configFile = Join-Path $botDir "config.json"
if (Test-Path $configFile) {
    $config = Get-Content $configFile | ConvertFrom-Json
    Write-Host "   SaaS URL: $($config.saasUrl)"
    Write-Host "   API Key: $($config.apiKey.Substring(0,15))..."
} else {
    Write-Host "   ❌ No hay archivo de configuración" -ForegroundColor Red
}

# Verificar logs recientes
Write-Host "`n📋 Últimos logs:" -ForegroundColor Gray
$logFile = Join-Path $botDir "logs\bot_*.log"
if (Test-Path $logFile) {
    $lastLog = Get-Content $logFile -Tail 20
    Write-Host $lastLog
} else {
    Write-Host "   No hay logs aún" -ForegroundColor Gray
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                    VERIFICACIÓN COMPLETADA                       ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
