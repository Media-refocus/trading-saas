<#
.SYNOPSIS
    Script de instalación automática del Trading Bot en VPS Windows

.DESCRIPTION
    Este script instala todo lo necesario para ejecutar el bot de trading:
    - Python 3.11+
    - MetaTrader 5
    - El bot Python
    - Servicio de Windows para ejecutar el bot

.PARAMETER ApiKey
    API key del SaaS para autenticar el bot

.PARAMETER SaasUrl
    URL del SaaS (ej: https://tu-saas.com)

.PARAMETER InstallPath
    Ruta de instalación (default: C:\TradingBot)

.PARAMETER SkipMT5
    No descargar MT5 (si ya está instalado)

.EXAMPLE
    .\setup-vps.ps1 -ApiKey "tb_xxx" -SaasUrl "https://trading.ejemplo.com"

.NOTES
    Ejecutar como Administrador
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [Parameter(Mandatory=$true)]
    [string]$SaasUrl,

    [string]$InstallPath = "C:\TradingBot",

    [switch]$SkipMT5
)

# Configuración
$ErrorActionPreference = "Stop"
$PythonVersion = "3.11.9"
$PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-amd64.exe"
$RepoUrl = "https://github.com/Media-refocus/trading-saas.git"

# Colores para output
function Write-Header {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# Verificar admin
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ============================================
# INICIO
# ============================================

Write-Header "Trading Bot VPS Setup"

if (-not (Test-Administrator)) {
    Write-Error "Este script debe ejecutarse como Administrador"
    exit 1
}

Write-Info "ApiKey: $($ApiKey.Substring(0, [Math]::Min(10, $ApiKey.Length)))..."
Write-Info "SaasUrl: $SaasUrl"
Write-Info "InstallPath: $InstallPath"

# ============================================
# 1. CREAR DIRECTORIOS
# ============================================

Write-Header "1. Creando directorios"

$directories = @(
    $InstallPath,
    "$InstallPath\bot",
    "$InstallPath\logs",
    "$InstallPath\python"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Creado: $dir"
    } else {
        Write-Info "Existe: $dir"
    }
}

# ============================================
# 2. INSTALAR PYTHON
# ============================================

Write-Header "2. Instalando Python $PythonVersion"

$pythonExe = Get-Command python -ErrorAction SilentlyContinue

if ($pythonExe) {
    $installedVersion = & python --version 2>&1
    Write-Info "Python ya instalado: $installedVersion"
} else {
    Write-Info "Descargando Python..."
    $pythonInstaller = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri $PythonUrl -OutFile $pythonInstaller

    Write-Info "Instalando Python..."
    Start-Process -FilePath $pythonInstaller -ArgumentList @(
        "/quiet",
        "InstallAllUsers=1",
        "PrependPath=1",
        "Include_pip=1"
    ) -Wait

    # Refrescar PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Success "Python instalado"
}

# ============================================
# 3. INSTALAR DEPENDENCIAS PYTHON
# ============================================

Write-Header "3. Instalando dependencias Python"

$requirements = @"
requests>=2.31.0
telethon>=1.33.1
MetaTrader5>=5.0.45
python-dotenv>=1.0.0
"@

$requirementsPath = "$InstallPath\bot\requirements.txt"
$requirements | Out-File -FilePath $requirementsPath -Encoding utf8

Write-Info "Instalando paquetes..."
& pip install -r $requirementsPath --quiet

Write-Success "Dependencias instaladas"

# ============================================
# 4. DESCARGAR BOT
# ============================================

Write-Header "4. Descargando código del bot"

# Opción A: Clonar repo (si hay git)
$gitExe = Get-Command git -ErrorAction SilentlyContinue

if ($gitExe) {
    Write-Info "Clonando desde GitHub..."
    Push-Location $InstallPath
    git clone $RepoUrl temp-repo --depth 1 2>$null
    Copy-Item -Path "temp-repo\bot\*" -Destination "bot\" -Recurse -Force
    Remove-Item -Path "temp-repo" -Recurse -Force
    Pop-Location
    Write-Success "Código descargado via git"
} else {
    # Opción B: Descargar ZIP
    Write-Info "Descargando ZIP..."
    $zipUrl = "https://github.com/Media-refocus/trading-saas/archive/refs/heads/master.zip"
    $zipPath = "$env:TEMP\trading-bot.zip"

    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

    # Extraer
    Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\trading-bot-extract" -Force
    Copy-Item -Path "$env:TEMP\trading-bot-extract\trading-saas-master\bot\*" -Destination "$InstallPath\bot\" -Recurse -Force

    Remove-Item $zipPath -Force
    Remove-Item "$env:TEMP\trading-bot-extract" -Recurse -Force

    Write-Success "Código descargado via ZIP"
}

# ============================================
# 5. CREAR CONFIGURACIÓN
# ============================================

Write-Header "5. Creando configuración"

$configPath = "$InstallPath\bot\config.json"
$config = @{
    apiKey = $ApiKey
    saasUrl = $SaasUrl
    logLevel = "INFO"
    heartbeatIntervalSeconds = 30
    configRefreshIntervalSeconds = 300
}

$config | ConvertTo-Json | Out-File -FilePath $configPath -Encoding utf8

Write-Success "Configuración creada: $configPath"

# ============================================
# 6. DESCARGAR MT5 (opcional)
# ============================================

if (-not $SkipMT5) {
    Write-Header "6. Descargando MetaTrader 5"

    $mt5Path = "$InstallPath\mt5"

    if (-not (Test-Path "$mt5Path\terminal64.exe")) {
        Write-Info "Descargando MT5..."
        # Nota: ICMarkets MT5 como ejemplo
        $mt5Url = "https://download.mql5.com/cdn/web/metaquotes/mt5/mt5setup.exe"
        $mt5Installer = "$env:TEMP\mt5setup.exe"

        Invoke-WebRequest -Uri $mt5Url -OutFile $mt5Installer

        Write-Info "Instalando MT5 (requiere interacción manual)..."
        Write-Info "Por favor, completa la instalación de MT5 cuando se abra."
        Start-Process -FilePath $mt5Installer -Wait

        Write-Success "MT5 instalado"
    } else {
        Write-Info "MT5 ya existe en $mt5Path"
    }
} else {
    Write-Info "Saltando instalación de MT5"
}

# ============================================
# 7. CREAR SERVICIO DE WINDOWS
# ============================================

Write-Header "7. Creando servicio de Windows"

# Crear script de inicio
$startScript = @"
@echo off
cd /d $InstallPath\bot
python bot_operativo.py --api-key $ApiKey --url $SaasUrl
"@

$startScriptPath = "$InstallPath\start-bot.bat"
$startScript | Out-File -FilePath $startScriptPath -Encoding ascii

# Crear servicio usando NSSM (Non-Sucking Service Manager)
$nssmPath = "$InstallPath\nssm.exe"

if (-not (Test-Path $nssmPath)) {
    Write-Info "Descargando NSSM..."
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm.zip"

    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
    Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
    Copy-Item -Path "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" -Destination $nssmPath -Force

    Remove-Item $nssmZip -Force
    Remove-Item "$env:TEMP\nssm" -Recurse -Force
}

# Instalar servicio
Write-Info "Instalando servicio TradingBot..."
& $nssmPath install TradingBot $startScriptPath
& $nssmPath set TradingBot AppDirectory $InstallPath\bot
& $nssmPath set TradingBot DisplayName "Trading Bot Service"
& $nssmPath set TradingBot Description "Trading bot que conecta con el SaaS"
& $nssmPath set TradingBot Start SERVICE_AUTO_START
& $nssmPath set TradingBot AppStdout "$InstallPath\logs\bot-stdout.log"
& $nssmPath set TradingBot AppStderr "$InstallPath\logs\bot-stderr.log"
& $nssmPath set TradingBot AppRotateFiles 1
& $nssmPath set TradingBot AppRotateBytes 1048576

Write-Success "Servicio TradingBot creado"

# ============================================
# 8. CONFIGURAR FIREWALL
# ============================================

Write-Header "8. Configurando Firewall"

# Permitir salida HTTPS (para SaaS)
New-NetFirewallRule -DisplayName "Trading Bot - HTTPS Out" -Direction Outbound -Protocol TCP -RemotePort 443 -Action Allow -ErrorAction SilentlyContinue

Write-Success "Firewall configurado"

# ============================================
# FINAL
# ============================================

Write-Header "Instalación completada"

Write-Host ""
Write-Host "El bot está listo para ejecutarse." -ForegroundColor Green
Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Yellow
Write-Host "  Iniciar:     Start-Service TradingBot" -ForegroundColor White
Write-Host "  Detener:     Stop-Service TradingBot" -ForegroundColor White
Write-Host "  Estado:      Get-Service TradingBot" -ForegroundColor White
Write-Host "  Ver logs:    Get-Content $InstallPath\logs\bot-stdout.log -Tail 50" -ForegroundColor White
Write-Host ""
Write-Host "Antes de iniciar el bot:" -ForegroundColor Yellow
Write-Host "  1. Abre MT5 y conecta a tu cuenta" -ForegroundColor White
Write-Host "  2. Verifica que el símbolo XAUUSD está disponible" -ForegroundColor White
Write-Host "  3. Inicia el servicio: Start-Service TradingBot" -ForegroundColor White
Write-Host ""

# Preguntar si iniciar
$startNow = Read-Host "¿Iniciar el servicio ahora? (S/N)"
if ($startNow -eq "S" -or $startNow -eq "s") {
    Start-Service TradingBot
    Write-Success "Servicio iniciado"
}
