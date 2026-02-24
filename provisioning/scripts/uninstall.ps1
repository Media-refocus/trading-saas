# Trading Bot SaaS - Desinstalador
# ==================================
# Elimina completamente el bot del sistema

param(
    [string]$InstallPath = "C:\TradingBot",

    [switch]$RemoveData,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║         TRADING BOT SAAS - Desinstalador                        ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Yellow

if (-not $Force) {
    $confirm = Read-Host "¿Estás seguro de que quieres desinstalar el bot? (S/N): "
    if ($confirm -ne "S") {
        Write-Host "Operación cancelada"
        exit 0
    }
}

# ───────────────────────── Detener servicio ─────────────────────────
Write-Host "`nDeteniendo servicio..." -ForegroundColor Gray

$service = Get-Service -Name "TradingBotSaaS" -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq "Running") {
        Stop-Service -Name "TradingBotSaaS" -Force
        Write-Host "✅ Servicio detenido"
    }

    # Eliminar servicio
    $servicePath = Join-Path $InstallPath "TradingBotSaaS-service.ps1"
    & $servicePath -Uninstall -RemoveData:$RemoveData
    Write-Host "✅ Servicio eliminado"
}

# ───────────────────────── Eliminar archivos ─────────────────────────
Write-Host "`nEliminando archivos..." -ForegroundColor Gray

if (Test-Path $InstallPath) {
    if ($RemoveData) {
        Remove-Item -Path $InstallPath -Recurse -Force
        Write-Host "✅ Todos los datos eliminados"
    } else {
        # Mantener config y logs
        $botDir = Join-Path $InstallPath "bot-saas"
        $venvDir = Join-Path $InstallPath "venv"

        if (Test-Path $botDir) {
            Get-ChildItem -Path $botDir -Exclude "config.json",".env","logs" | Remove-Item -Force -Recurse
            Write-Host "✅ Bot eliminado (config y logs conservados)"
        }

        if (Test-Path $venvDir) {
            Remove-Item -Path $venvDir -Recurse -Force
            Write-Host "✅ Entorno virtual eliminado"
        }
    }
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                 DESINSTALACIÓN COMPLETADA                          ║
║                                                              ║
║  El bot ha sido eliminado correctamente.                       ║
║  MT5 sigue instalado si lo necesitas para operar manualmente.  ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
