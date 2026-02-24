# Trading Bot SaaS - Instalador Windows
# =======================================
# Script de instalación automática para VPS Windows
#
# Uso:
#   .\install-windows.ps1 -ApiKey "tb_xxx"
#
# Requisitos previos:
#   - VPS con Windows Server 2019+ o Windows 10/11
#   - MT5 instalado (o se instalará automáticamente)
#   - Conexión a internet

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [string]$SaasUrl = "https://tu-saas.com",

    [string]$InstallPath = "C:\TradingBot",

    [string]$Mt5Path = "",

    [switch]$SkipMt5Check,

    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colores para output
function Write-Step { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "⚠️ $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }

# Banner
Write-Host @"
╔════════════════════════════════════════════════════════════╗
║         TRADING BOT SAAS - Instalador Windows              ║
╠════════════════════════════════════════════════════════════╣
║  Este script instalará:                                    ║
║  • Python 3.11 (si no está instalado)                     ║
║  • El bot de trading                                       ║
║  • Servicio de auto-arranque                              ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor White

# ───────────────────────── Verificar requisitos ─────────────────────────
Write-Step "Verificando requisitos del sistema..."

# Verificar arquitectura
if (-not [Environment]::Is64BitOperatingSystem) {
    Write-Error "Se requiere sistema de 64 bits"
    exit 1
}
Write-Success "Sistema de 64 bits"

# Verificar memoria (mínimo 2GB)
$mem = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB
if ($mem -lt 2) {
    Write-Warning "Memoria recomendada: 4GB+ (actual: $([math]::Round($mem, 1))GB)"
} else {
    Write-Success "Memoria: $([math]::Round($mem, 1))GB"
}

# Verificar espacio en disco (mínimo 5GB)
$disk = (Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB
if ($disk -lt 5) {
    Write-Error "Espacio insuficiente en disco. Se requieren al menos 5GB libres."
    exit 1
}
Write-Success "Espacio en disco: $([math]::Round($disk, 1))GB libres"

# ───────────────────────── Verificar Python ─────────────────────────
Write-Step "Verificando Python..."

$pythonCmd = $null
$pythonVersion = $null

# Buscar Python 3.11+
$pythonPaths = @(
    "C:\Python311\python.exe",
    "C:\Python312\python.exe",
    "${env:LOCALAPPDATA}\Programs\Python\Python311\python.exe",
    "${env:LOCALAPPDATA}\Programs\Python\Python312\python.exe"
)

foreach ($path in $pythonPaths) {
    if (Test-Path $path) {
        $pythonCmd = $path
        break
    }
}

if (-not $pythonCmd) {
    # Buscar en PATH
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
}

if ($pythonCmd) {
    $versionOutput = & $pythonCmd --version 2>&1
    if ($versionOutput -match "Python (\d+)\.(\d+)") {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        if ($major -ge 3 -and $minor -ge 9) {
            $pythonVersion = "$major.$minor"
            Write-Success "Python $pythonVersion encontrado: $pythonCmd"
        }
    }
}

if (-not $pythonVersion) {
    Write-Warning "Python 3.9+ no encontrado. Instalando Python 3.11..."

    # Descargar Python
    $pythonInstaller = "$env:TEMP\python-installer.exe"
    $pythonUrl = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe"

    try {
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller -UseBasicParsing
        Write-Success "Python descargado"

        # Instalar Python
        Write-Host "Instalando Python... (esto puede tardar unos minutos)"
        Start-Process -FilePath $pythonInstaller -ArgumentList `
            "/quiet", "InstallAllUsers=1", "PrependPath=1", "Include_pip=1" `
            -Wait

        # Buscar Python recién instalado
        $pythonCmd = "C:\Python311\python.exe"
        if (-not (Test-Path $pythonCmd)) {
            $pythonCmd = "${env:LOCALAPPDATA}\Programs\Python\Python311\python.exe"
        }

        if (Test-Path $pythonCmd) {
            Write-Success "Python 3.11 instalado correctamente"
        } else {
            Write-Error "Error instalando Python. Instálalo manualmente desde python.org"
            exit 1
        }
    } catch {
        Write-Error "Error descargando Python: $_"
        exit 1
    }
}

# ───────────────────────── Crear directorio de instalación ─────────────────────────
Write-Step "Creando directorio de instalación..."

if (Test-Path $InstallPath) {
    Write-Warning "El directorio $InstallPath ya existe"
    $confirm = Read-Host "¿Deseas sobrescribirlo? (s/N)"
    if ($confirm -ne "s" -and $confirm -ne "S") {
        Write-Host "Instalación cancelada"
        exit 0
    }
    Remove-Item -Path $InstallPath -Recurse -Force
}

New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
Write-Success "Directorio creado: $InstallPath"

# ───────────────────────── Descargar bot ─────────────────────────
Write-Step "Descargando bot de trading..."

$botSource = Join-Path $PSScriptRoot "..\bot-saas"
if (Test-Path $botSource) {
    # Instalación local (desarrollo)
    Copy-Item -Path "$botSource\*" -Destination $InstallPath -Recurse -Force
    Write-Success "Bot copiado desde fuente local"
} else {
    # Descargar desde GitHub (producción)
    $botZip = "$env:TEMP\trading-bot.zip"
    $botUrl = "https://github.com/Media-refocus/trading-bot-saas/archive/refs/heads/main.zip"

    try {
        Invoke-WebRequest -Uri $botUrl -OutFile $botZip -UseBasicParsing
        Expand-Archive -Path $botZip -DestinationPath "$env:TEMP\bot-temp" -Force

        # Buscar carpeta del bot
        $botFolder = Get-ChildItem "$env:TEMP\bot-temp" -Directory | Select-Object -First 1
        $botSaasFolder = Join-Path $botFolder.FullName "bot-saas"

        if (Test-Path $botSaasFolder) {
            Copy-Item -Path "$botSaasFolder\*" -Destination $InstallPath -Recurse -Force
            Write-Success "Bot descargado desde GitHub"
        } else {
            Write-Error "No se encontró la carpeta del bot en el repositorio"
            exit 1
        }

        # Limpiar
        Remove-Item $botZip -Force
        Remove-Item "$env:TEMP\bot-temp" -Recurse -Force
    } catch {
        Write-Error "Error descargando el bot: $_"
        exit 1
    }
}

# ───────────────────────── Crear entorno virtual ─────────────────────────
Write-Step "Creando entorno virtual Python..."

$venvPath = Join-Path $InstallPath "venv"
& $pythonCmd -m venv $venvPath

if (-not (Test-Path $venvPath)) {
    Write-Error "Error creando entorno virtual"
    exit 1
}
Write-Success "Entorno virtual creado"

# ───────────────────────── Instalar dependencias ─────────────────────────
Write-Step "Instalando dependencias..."

$pipPath = Join-Path $venvPath "Scripts\pip.exe"
$reqPath = Join-Path $InstallPath "requirements.txt"

& $pipPath install --upgrade pip | Out-Null
& $pipPath install -r $reqPath

if ($LASTEXITCODE -eq 0) {
    Write-Success "Dependencias instaladas"
} else {
    Write-Error "Error instalando dependencias"
    exit 1
}

# ───────────────────────── Configurar bot ─────────────────────────
Write-Step "Configurando bot..."

$configContent = @"
# Configuracion del bot - Generado automaticamente
# ==================================================

# SaaS
SAAS_URL=$SaasUrl
API_KEY=$ApiKey

# MT5 (configurar despues)
MT5_LOGIN=
MT5_PASSWORD=
MT5_SERVER=
MT5_PATH=$Mt5Path

# Symbol
SYMBOL=XAUUSD
"@

$configPath = Join-Path $InstallPath ".env"
$configContent | Out-File -FilePath $configPath -Encoding UTF8
Write-Success "Archivo de configuracion creado: $configPath"

# ───────────────────────── Verificar MT5 ─────────────────────────
if (-not $SkipMt5Check) {
    Write-Step "Verificando MetaTrader 5..."

    $mt5Paths = @(
        "C:\Program Files\MetaTrader 5\terminal64.exe",
        "C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
        "C:\Program Files\VTMarkets\MetaTrader5\terminal64.exe",
        "C:\Program Files\Infinox\MetaTrader5\terminal64.exe"
    )

    $mt5Found = $false
    foreach ($path in $mt5Paths) {
        if (Test-Path $path) {
            $mt5Found = $true
            Write-Success "MT5 encontrado: $path"
            break
        }
    }

    if (-not $mt5Found) {
        Write-Warning "MT5 no encontrado en ubicaciones comunes"
        Write-Host "Descarga MT5 desde tu broker e instalalo antes de ejecutar el bot"
    }
}

# ───────────────────────── Crear script de inicio ─────────────────────────
Write-Step "Creando scripts de inicio..."

$startScript = @"
@echo off
cd /d $InstallPath
call venv\Scripts\activate.bat
python trading_bot_saas.py --api-key $ApiKey --saas-url $SaasUrl
pause
"@

$startScriptPath = Join-Path $InstallPath "iniciar-bot.bat"
$startScript | Out-File -FilePath $startScriptPath -Encoding ASCII
Write-Success "Script de inicio creado: $startScriptPath"

# ───────────────────────── Crear servicio de Windows ─────────────────────────
Write-Step "Configurando servicio de auto-arranque..."

$serviceScript = @"
# Servicio de Windows para Trading Bot
# Ejecutar como Administrador para instalar

`$ApiKey = "$ApiKey"
`$SaasUrl = "$SaasUrl"
`$InstallPath = "$InstallPath"

# Crear tarea programada
`$action = New-ScheduledTaskAction `
    -Execute "`$InstallPath\venv\Scripts\python.exe" `
    -Argument "trading_bot_saas.py --api-key `$ApiKey --saas-url `$SaasUrl" `
    -WorkingDirectory "`$InstallPath"

`$trigger = New-ScheduledTaskTrigger -AtStartup -RandomDelay (New-TimeSpan -Minutes 1)

`$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -RestartCount 3 `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

`$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName "TradingBotSaaS" `
    -Action `$action `
    -Trigger `$trigger `
    -Settings `$settings `
    -Principal `$principal `
    -Description "Trading Bot SaaS - Auto-arranque" `
    -Force

Write-Host "Servicio instalado correctamente"
"@

$serviceScriptPath = Join-Path $InstallPath "instalar-servicio.ps1"
$serviceScript | Out-File -FilePath $serviceScriptPath -Encoding UTF8
Write-Success "Script de servicio creado: $serviceScriptPath"

# Preguntar si instalar servicio
$installService = Read-Host "¿Deseas instalar el servicio de auto-arranque ahora? (s/N)"
if ($installService -eq "s" -or $installService -eq "S") {
    try {
        & $serviceScriptPath
        Write-Success "Servicio de auto-arranque instalado"
    } catch {
        Write-Warning "No se pudo instalar el servicio. Ejecuta instalar-servicio.ps1 como Administrador"
    }
}

# ───────────────────────── Resumen final ─────────────────────────
Write-Host @"

╔════════════════════════════════════════════════════════════╗
║              INSTALACION COMPLETADA                        ║
╠════════════════════════════════════════════════════════════╣
╠════════════════════════════════════════════════════════════╣
║  Directorio: $InstallPath
║
║  PROXIMOS PASOS:
║
║  1. Configura MT5:
║     - Instala MT5 desde tu broker
║     - Abre MT5 y haz login
║
║  2. Edita el archivo .env con tus credenciales MT5:
║     $configPath
║
║  3. Inicia el bot:
║     - Opcion A: Ejecuta iniciar-bot.bat
║     - Opcion B: El servicio se iniciara automaticamente
║
║  4. Verifica en el dashboard del SaaS que el bot esta conectado
║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

Write-Host "Para soporte: soporte@tu-saas.com" -ForegroundColor Gray
