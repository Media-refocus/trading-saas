# Setup del Bot Python - Trading Bot SaaS
# Este script configura el entorno del bot Python

param(
    [string]$ApiKey = "",
    [string]$SaasUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Trading Bot - Setup Python Bot" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Python
Write-Host "[1/5] Verificando Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Python no encontrado. Instala Python 3.9+" -ForegroundColor Red
    exit 1
}

# Verificar pip
Write-Host "[2/5] Verificando pip..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    Write-Host "  ✓ $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ pip no encontrado" -ForegroundColor Red
    exit 1
}

# Crear entorno virtual
Write-Host "[3/5] Creando entorno virtual..." -ForegroundColor Yellow
$venvPath = Join-Path $PSScriptRoot "venv"
if (Test-Path $venvPath) {
    Write-Host "  ✓ Entorno virtual ya existe" -ForegroundColor Green
} else {
    python -m venv $venvPath
    Write-Host "  ✓ Entorno virtual creado" -ForegroundColor Green
}

# Activar entorno virtual
Write-Host "[4/5] Activando entorno virtual..." -ForegroundColor Yellow
& "$venvPath\Scripts\Activate.ps1"
Write-Host "  ✓ Entorno activado" -ForegroundColor Green

# Instalar dependencias
Write-Host "[5/5] Instalando dependencias..." -ForegroundColor Yellow
$requirementsPath = Join-Path $PSScriptRoot "requirements.txt"
pip install -r $requirementsPath --quiet
Write-Host "  ✓ Dependencias instaladas" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup completado!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Pedir API key si no se proporcionó
if ($ApiKey -eq "") {
    Write-Host "Para ejecutar el bot, necesitas la API key del SaaS." -ForegroundColor Yellow
    Write-Host "1. Ve al dashboard: $SaasUrl/bot" -ForegroundColor White
    Write-Host "2. Copia la API key" -ForegroundColor White
    Write-Host ""
    $ApiKey = Read-Host "Introduce tu API key"
}

# Crear archivo .env
$envPath = Join-Path $PSScriptRoot ".env"
$envContent = @"
TRADING_BOT_API_KEY=$ApiKey
TRADING_BOT_SAAS_URL=$SaasUrl
"@
$envContent | Out-File -FilePath $envPath -Encoding utf8
Write-Host "  ✓ Archivo .env creado" -ForegroundColor Green

Write-Host ""
Write-Host "Para ejecutar el bot:" -ForegroundColor Yellow
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  python bot_operativo.py" -ForegroundColor White
Write-Host ""
Write-Host "O con argumentos:" -ForegroundColor Yellow
Write-Host "  python bot_operativo.py --api-key $ApiKey --saas-url $SaasUrl" -ForegroundColor White
Write-Host ""

# Preguntar si quiere ejecutar ahora
$run = Read-Host "¿Ejecutar el bot ahora? (s/n)"
if ($run -eq "s" -or $run -eq "S") {
    Write-Host ""
    Write-Host "Iniciando bot..." -ForegroundColor Green
    python bot_operativo.py
}
