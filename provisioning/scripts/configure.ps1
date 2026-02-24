# Trading Bot SaaS - Configuración
# ==================================
# Configura el bot con las credenciales

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [Parameter(Mandatory=$true)]
    [string]$Mt5Login,

    [Parameter(Mandatory=$true)]
    [string]$Mt5Password,

    [Parameter(Mandatory=$true)]
    [string]$Mt5Server,

    [string]$SaasUrl = "https://tu-saas.com",

    [string]$Symbol = "XAUUSD",

    [string]$InstallPath = "C:\TradingBot"
)

$ErrorActionPreference = "Stop"

# ─────────────────────────── Main ───────────────────────────

Write-Host "Configurando Trading Bot SaaS..." -ForegroundColor Cyan

$botDir = Join-Path $InstallPath "bot-saas"
$configFile = Join-Path $botDir "config.json"
$envFile = Join-Path $botDir ".env"

# Verificar que el bot existe
if (-not (Test-Path $botDir)) {
    Write-Host "❌ Bot no encontrado. Ejecuta primero install-windows.ps1" -ForegroundColor Red
    exit 1
}

# Crear config.json
$config = @{
    apiKey = "$ApiKey"
    saasUrl = "$SaasUrl"
    mt5Login = $Mt5Login
    mt5Password = $Mt5Password
    mt5Server = $Mt5Server
    symbol = $Symbol
    createdAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
}

$config | ConvertTo-Json $config | Out-File -FilePath $configFile -Encoding UTF8
Write-Host "✅ Creado: $configFile" -ForegroundColor Green

# Crear .env para variables de entorno
$envContent = @"
MT5_LOGIN=$Mt5Login
MT5_PASSWORD=$Mt5Password
MT5_SERVER=$Mt5Server
"@

$envContent | Out-File -FilePath $envFile -Encoding UTF8
Write-Host "✅ Creado: $envFile" -ForegroundColor Green

# Verificar configuración
Write-Host "`nConfiguración guardada en: $configFile" -ForegroundColor Gray
Get-Content $configFile | Write-Host

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║  CONFIGURACIÓN COMPLETADA                                 ║
╠════════════════════════════════════════════════════════════╣
║  API Key: $ApiKey
║  SaaS URL: $SaasUrl
║  MT5 Login: $Mt5Login
║  MT5 Server: $Mt5Server
║  Symbol: $Symbol
╠════════════════════════════════════════════════════════════╣
╠  IMPORTANTE: Guarda config.json y .env en un lugar seguro
╠  No compartas estas credenciales con nadie.
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Yellow
