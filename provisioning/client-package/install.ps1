<#
.SYNOPSIS
    Instalador del Trading Bot para clientes - Version Simplificada

.DESCRIPTION
    Este script instala todo lo necesario para ejecutar el bot de trading en tu VPS Windows.
    - Verifica requisitos del sistema
    - Instala Python (si no esta)
    - Descarga el bot
    - Configura la conexion con el SaaS
    - Crea un servicio de Windows para auto-arranque

.PARAMETER ApiKey
    Tu API Key del dashboard de Trading Bot (obligatoria)

.PARAMETER SaasUrl
    URL del SaaS (por defecto: https://tu-saas.com)

.EXAMPLE
    .\install.ps1 -ApiKey "tb_xxxxxxxxxxxxx"

.NOTES
    Ejecutar como Administrador
    Version: 1.0.0
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [string]$SaasUrl = "https://tu-saas.com",

    [string]$InstallPath = "C:\TradingBot"
)

$ErrorActionPreference = "Stop"
$Version = "1.0.0"

# ============================================
# FUNCIONES DE UTILIDAD
# ============================================

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [i] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [X] $Message" -ForegroundColor Red
}

function Write-Step {
    param([int]$Number, [string]$Message)
    Write-Host ""
    Write-Host "  Paso $Number`: $Message" -ForegroundColor White
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Command {
    param([string]$Command)
    return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# ============================================
# INICIO
# ============================================

Clear-Host
Write-Host ""
Write-Host "  ██████╗ ████████╗ █████╗ ██████╗     ████████╗ █████╗ ██████╗ ███████╗" -ForegroundColor Blue
Write-Host "  ██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗    ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝" -ForegroundColor Blue
Write-Host "  ██║  ██║   ██║   ███████║██████╔╝        ██║   ███████║██████╔╝█████╗  " -ForegroundColor Blue
Write-Host "  ██║  ██║   ██║   ██╔══██║██╔══██╗       ██║   ██╔══██║██╔══██╗██╔══╝  " -ForegroundColor Blue
Write-Host "  ██████╔╝   ██║   ██║  ██║██║  ██║       ██║   ██║  ██║██║  ██║███████╗" -ForegroundColor Blue
Write-Host "  ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝       ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝" -ForegroundColor Blue
Write-Host ""
Write-Host "  Instalador v$Version - Trading Bot SaaS" -ForegroundColor DarkGray
Write-Host ""

# Verificar admin
if (-not (Test-Administrator)) {
    Write-Err "Este script debe ejecutarse como Administrador"
    Write-Info "Click derecho en PowerShell -> 'Ejecutar como administrador'"
    pause
    exit 1
}

# Mostrar configuracion
Write-Info "API Key: $($ApiKey.Substring(0, [Math]::Min(10, $ApiKey.Length)))..."
Write-Info "SaaS URL: $SaasUrl"
Write-Info "Ruta instalacion: $InstallPath"

# ============================================
# PASO 1: VERIFICAR REQUISITOS
# ============================================

Write-Header "Paso 1: Verificando requisitos"

# Windows version
$os = Get-CimInstance Win32_OperatingSystem
Write-Info "Sistema: $($os.Caption)"
Write-Info "RAM: $([Math]::Round($os.TotalVisibleMemorySize / 1MB, 1)) GB"

if ($os.TotalVisibleMemorySize -lt 3GB) {
    Write-Err "Se necesitan minimo 4GB RAM"
    exit 1
}
Write-Success "RAM suficiente"

# Espacio disco
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$freeGB = [Math]::Round($disk.FreeSpace / 1GB, 1)
Write-Info "Espacio libre C:: $freeGB GB"

if ($freeGB -lt 10) {
    Write-Err "Se necesitan minimo 10GB libres"
    exit 1
}
Write-Success "Espacio suficiente"

# MT5
$mt5Paths = @(
    "C:\Program Files\MetaTrader 5\terminal64.exe",
    "C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    "${env:ProgramFiles}\MetaTrader 5\terminal64.exe"
)

$mt5Found = $false
foreach ($path in $mt5Paths) {
    if (Test-Path $path) {
        Write-Success "MT5 encontrado: $path"
        $mt5Found = $true
        break
    }
}

if (-not $mt5Found) {
    Write-Err "MetaTrader 5 no encontrado"
    Write-Info "Por favor, instala MT5 antes de continuar:"
    Write-Info "1. Descarga desde tu broker (ej: ICMarkets, Infinox...)"
    Write-Info "2. Instala y abre MT5"
    Write-Info "3. Conecta con tu cuenta (login/password)"
    Write-Info "4. Vuelve a ejecutar este script"
    pause
    exit 1
}

# ============================================
# PASO 2: CREAR DIRECTORIOS
# ============================================

Write-Header "Paso 2: Creando directorios"

$directories = @(
    $InstallPath,
    "$InstallPath\bot",
    "$InstallPath\logs",
    "$InstallPath\data"
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
# PASO 3: INSTALAR PYTHON
# ============================================

Write-Header "Paso 3: Instalando Python"

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue

if ($pythonCmd) {
    $pyVersion = & python --version 2>&1
    Write-Success "Python ya instalado: $pyVersion"
} else {
    Write-Info "Descargando Python 3.11..."

    $pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    $pythonInstaller = "$env:TEMP\python-installer.exe"

    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller -UseBasicParsing

    Write-Info "Instalando Python (esto puede tardar un minuto)..."
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
# PASO 4: INSTALAR DEPENDENCIAS
# ============================================

Write-Header "Paso 4: Instalando dependencias"

$requirements = @"
requests>=2.31.0
MetaTrader5>=5.0.45
python-dotenv>=1.0.0
websocket-client>=1.6.0
"@

$requirementsPath = "$InstallPath\bot\requirements.txt"
$requirements | Out-File -FilePath $requirementsPath -Encoding utf8 -NoNewline

Write-Info "Instalando paquetes Python..."
& pip install -r $requirementsPath --quiet 2>&1 | Out-Null

Write-Success "Dependencias instaladas"

# ============================================
# PASO 5: DESCARGAR BOT
# ============================================

Write-Header "Paso 5: Descargando bot"

# Crear archivo del bot principal
$botCode = @'
#!/usr/bin/env python3
"""
Trading Bot - Cliente para SaaS
Conecta con MT5 local y el SaaS para recibir configuracion
"""

import os
import sys
import json
import time
import logging
import argparse
from datetime import datetime
from pathlib import Path

import requests
import MetaTrader5 as mt5

# Configuracion
CONFIG_FILE = Path(__file__).parent / "config.json"
LOG_DIR = Path(__file__).parent.parent / "logs"

# Setup logging
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class TradingBot:
    def __init__(self, api_key: str, saas_url: str):
        self.api_key = api_key
        self.saas_url = saas_url.rstrip('/')
        self.config = None
        self.running = True
        self.last_heartbeat = 0
        self.heartbeat_interval = 30  # segundos

    def load_config(self):
        """Carga configuracion desde el SaaS"""
        try:
            response = requests.get(
                f"{self.saas_url}/api/bot/config",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10
            )
            if response.status_code == 200:
                self.config = response.json()
                logger.info(f"Configuracion cargada: {self.config.get('strategy', 'default')}")
                return True
            elif response.status_code == 401:
                logger.error("API Key invalida o suscripcion inactiva")
                return False
            else:
                logger.error(f"Error cargando config: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error conectando con SaaS: {e}")
            return False

    def send_heartbeat(self):
        """Envia heartbeat al SaaS"""
        try:
            # Obtener info de MT5
            account_info = mt5.account_info()
            positions = mt5.positions_get()

            payload = {
                "timestamp": datetime.utcnow().isoformat(),
                "mt5_connected": account_info is not None,
                "telegram_connected": False,  # TODO
                "open_positions": len(positions) if positions else 0,
                "balance": account_info.balance if account_info else 0,
                "equity": account_info.equity if account_info else 0,
            }

            response = requests.post(
                f"{self.saas_url}/api/bot/heartbeat",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                logger.debug("Heartbeat enviado OK")
                return True
            else:
                logger.warning(f"Heartbeat fallido: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error enviando heartbeat: {e}")
            return False

    def check_kill_switch(self):
        """Verifica si el kill switch esta activado"""
        try:
            response = requests.get(
                f"{self.saas_url}/api/bot/status",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("kill_switch", False):
                    logger.warning("KILL SWITCH ACTIVADO - Deteniendo bot")
                    return True
        except Exception as e:
            logger.error(f"Error verificando kill switch: {e}")
        return False

    def connect_mt5(self):
        """Conecta con MT5"""
        if not mt5.initialize():
            logger.error(f"Error inicializando MT5: {mt5.last_error()}")
            return False

        account_info = mt5.account_info()
        if account_info is None:
            logger.error("No hay cuenta conectada en MT5")
            logger.info("Por favor, abre MT5 y conecta con tu cuenta")
            return False

        logger.info(f"MT5 conectado: {account_info.login} @ {account_info.server}")
        logger.info(f"Balance: {account_info.balance} {account_info.currency}")
        return True

    def run(self):
        """Loop principal del bot"""
        logger.info("=" * 50)
        logger.info("INICIANDO TRADING BOT")
        logger.info("=" * 50)

        # Cargar configuracion
        if not self.load_config():
            logger.error("No se pudo cargar configuracion. Deteniendo.")
            return

        # Conectar MT5
        if not self.connect_mt5():
            logger.error("No se pudo conectar MT5. Deteniendo.")
            return

        logger.info("Bot iniciado correctamente")
        logger.info(f"Heartbeat cada {self.heartbeat_interval}s")

        # Loop principal
        while self.running:
            try:
                current_time = time.time()

                # Enviar heartbeat
                if current_time - self.last_heartbeat >= self.heartbeat_interval:
                    self.send_heartbeat()
                    self.last_heartbeat = current_time

                # Verificar kill switch
                if self.check_kill_switch():
                    self.running = False
                    break

                # TODO: Logica de trading

                time.sleep(1)

            except KeyboardInterrupt:
                logger.info("Interrupcion de usuario")
                self.running = False
            except Exception as e:
                logger.error(f"Error en loop principal: {e}")
                time.sleep(5)

        # Cleanup
        mt5.shutdown()
        logger.info("Bot detenido")


def main():
    parser = argparse.ArgumentParser(description="Trading Bot Cliente")
    parser.add_argument("--api-key", required=True, help="API Key del SaaS")
    parser.add_argument("--url", default="https://tu-saas.com", help="URL del SaaS")
    args = parser.parse_args()

    bot = TradingBot(api_key=args.api_key, saas_url=args.url)
    bot.run()


if __name__ == "__main__":
    main()
'@

$botPath = "$InstallPath\bot\bot.py"
$botCode | Out-File -FilePath $botPath -Encoding utf8 -NoNewline

Write-Success "Bot descargado"

# ============================================
# PASO 6: CREAR CONFIGURACION
# ============================================

Write-Header "Paso 6: Creando configuracion"

$config = @{
    apiKey = $ApiKey
    saasUrl = $SaasUrl
    logLevel = "INFO"
    heartbeatIntervalSeconds = 30
    configRefreshIntervalSeconds = 300
}

$configPath = "$InstallPath\bot\config.json"
$config | ConvertTo-Json | Out-File -FilePath $configPath -Encoding utf8

Write-Success "Configuracion creada"

# ============================================
# PASO 7: CREAR SCRIPTS AUXILIARES
# ============================================

Write-Header "Paso 7: Creando scripts auxiliares"

# Start script
$startScript = @"
@echo off
cd /d $InstallPath\bot
python bot.py --api-key $ApiKey --url $SaasUrl
pause
"@
$startScript | Out-File -FilePath "$InstallPath\start-bot.bat" -Encoding ascii
Write-Success "start-bot.bat creado"

# Stop script
$stopScript = @"
@echo off
echo Deteniendo Trading Bot...
taskkill /f /im python.exe /fi "windowtitle eq Trading Bot*" 2>nul
net stop TradingBot 2>nul
echo Bot detenido.
pause
"@
$stopScript | Out-File -FilePath "$InstallPath\stop-bot.bat" -Encoding ascii
Write-Success "stop-bot.bat creado"

# Status script
$statusScript = @"
@echo off
echo === Trading Bot Status ===
echo.
sc query TradingBot 2>nul
echo.
echo === Ultimas lineas de log ===
echo.
type "$InstallPath\logs\bot.log" 2>nul | more +1
pause
"@
$statusScript | Out-File -FilePath "$InstallPath\status-bot.bat" -Encoding ascii
Write-Success "status-bot.bat creado"

# ============================================
# PASO 8: CREAR SERVICIO WINDOWS
# ============================================

Write-Header "Paso 8: Creando servicio de Windows"

# Descargar NSSM
$nssmPath = "$InstallPath\nssm.exe"

if (-not (Test-Path $nssmPath)) {
    Write-Info "Descargando NSSM..."
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm.zip"

    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
    Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
    Copy-Item -Path "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" -Destination $nssmPath -Force

    Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\nssm" -Recurse -Force -ErrorAction SilentlyContinue

    Write-Success "NSSM descargado"
}

# Instalar servicio
Write-Info "Instalando servicio TradingBot..."

& $nssmPath install TradingBot "C:\Windows\System32\cmd.exe" "/c $InstallPath\start-bot.bat" 2>&1 | Out-Null
& $nssmPath set TradingBot AppDirectory "$InstallPath\bot" 2>&1 | Out-Null
& $nssmPath set TradingBot DisplayName "Trading Bot SaaS" 2>&1 | Out-Null
& $nssmPath set TradingBot Description "Bot de trading automatico - conecta con SaaS" 2>&1 | Out-Null
& $nssmPath set TradingBot Start SERVICE_AUTO_START 2>&1 | Out-Null
& $nssmPath set TradingBot AppStdout "$InstallPath\logs\bot-stdout.log" 2>&1 | Out-Null
& $nssmPath set TradingBot AppStderr "$InstallPath\logs\bot-stderr.log" 2>&1 | Out-Null
& $nssmPath set TradingBot AppRotateFiles 1 2>&1 | Out-Null
& $nssmPath set TradingBot AppRotateBytes 1048576 2>&1 | Out-Null

Write-Success "Servicio TradingBot instalado"

# ============================================
# FINAL
# ============================================

Write-Header "Instalacion completada!"

Write-Host ""
Write-Host "  El bot esta listo para ejecutarse." -ForegroundColor Green
Write-Host ""
Write-Host "  ANTES DE INICIAR:" -ForegroundColor Yellow
Write-Host "  1. Abre MetaTrader 5" -ForegroundColor White
Write-Host "  2. Conecta con tu cuenta (File -> Login to Trade Account)" -ForegroundColor White
Write-Host "  3. Verifica que XAUUSD esta disponible en Market Watch" -ForegroundColor White
Write-Host ""
Write-Host "  PARA INICIAR EL BOT:" -ForegroundColor Yellow
Write-Host "  - Opcion A: Ejecuta $InstallPath\start-bot.bat" -ForegroundColor White
Write-Host "  - Opcion B: Inicia el servicio: Start-Service TradingBot" -ForegroundColor White
Write-Host ""
Write-Host "  COMANDOS UTILES:" -ForegroundColor Yellow
Write-Host "  start-bot.bat    - Iniciar bot manualmente" -ForegroundColor White
Write-Host "  stop-bot.bat     - Detener bot" -ForegroundColor White
Write-Host "  status-bot.bat   - Ver estado y logs" -ForegroundColor White
Write-Host ""

# Preguntar si iniciar
$startNow = Read-Host "  Iniciar el bot ahora? (S/N)"
if ($startNow -eq "S" -or $startNow -eq "s") {
    Write-Info "Iniciando bot..."
    Start-Service TradingBot
    Start-Sleep -Seconds 3
    Get-Service TradingBot
}
