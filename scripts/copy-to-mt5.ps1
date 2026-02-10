#!/usr/bin/env pwsh
# copy-to-mt5.ps1 - Copia EAs y CSVs a todas las instalaciones de MT5

$ProjectRoot = "C:\Users\guill\Projects\trading-bot-saas"
$Mql5BasePath = "C:\Users\guill\AppData\Roaming\MetaQuotes\Terminal"

# Colores para output
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Section($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Yellow }

Write-Section "COPIA DE EAS XISCO A MT5"

# Encontrar todas las carpetas MQL5
Write-Info "Buscando instalaciones de MT5..."
$mql5Folders = Get-ChildItem -Path $Mql5BasePath -Directory -Filter "*MQL5" -Recurse -Depth 1 -ErrorAction SilentlyContinue

if ($mql5Folders.Count -eq 0) {
    Write-Error "No se encontraron carpetas MQL5"
    exit 1
}

Write-Success "Encontradas $($mql5Folders.Count) instalaciones de MT5"

# Archivos a copiar
$easToCopy = @(
    "Backtester_Xisco_G2.mq5",
    "Backtester_Xisco_G4.mq5",
    "Backtester_Xisco_Restrictions.mq5"
)

$csvToCopy = @(
    "signals_simple.csv"
)

# Copiar a cada instalación
foreach ($mql5 in $mql5Folders) {
    $expertsPath = Join-Path $mql5.FullName "Experts"
    $filesPath = Join-Path $mql5.FullName "Files"

    Write-Section "Procesando: $($mql5.FullName)"

    # Crear carpetas si no existen
    if (-not (Test-Path $expertsPath)) {
        New-Item -ItemType Directory -Path $expertsPath -Force | Out-Null
        Write-Info "Carpeta Experts creada"
    }
    if (-not (Test-Path $filesPath)) {
        New-Item -ItemType Directory -Path $filesPath -Force | Out-Null
        Write-Info "Carpeta Files creada"
    }

    # Copiar EAs
    $copiedEas = 0
    foreach ($ea in $easToCopy) {
        $source = Join-Path $ProjectRoot "eas\$ea"
        $dest = Join-Path $expertsPath $ea

        if (Test-Path $source) {
            Copy-Item -Path $source -Destination $dest -Force
            $copiedEas++
            Write-Success "  $ea"
        } else {
            Write-Error "  No encontrado: $source"
        }
    }

    # Copiar CSVs
    $copiedCsvs = 0
    foreach ($csv in $csvToCopy) {
        $source = Join-Path $ProjectRoot $csv
        $dest = Join-Path $filesPath $csv

        if (Test-Path $source) {
            Copy-Item -Path $source -Destination $dest -Force
            $copiedCsvs++
            Write-Success "  $csv"
        } else {
            Write-Info "  No encontrado: $source (puede no existir todavía)"
        }
    }

    Write-Success "Instalación completada: $copiedEas EAs, $copiedCsvs CSVs"
}

Write-Section "RESUMEN"
Write-Success "EAs copiados a $($mql5Folders.Count) instalaciones"
Write-Info "Reinicia MetaTrader 5 y compila los EAs (F7 en MetaEditor)"
Write-Info "Los CSVs ya están listos para usar en el Strategy Tester"

# Opción de abrir MetaEditor
Write-Section "¿Abrir MetaEditor?"
$response = Read-Host "Abrir MetaEditor para compilar EAs? (S/N)"
if ($response -eq "S" -or $response -eq "s") {
    # Intentar abrir MetaEditor (puede variar la ruta)
    $metaEditorPaths = @(
        "C:\Program Files\MetaTrader 5\metaeditor64.exe",
        "C:\Program Files (x86)\MetaTrader 5\metaeditor64.exe",
        "${env:ProgramFiles}\MetaTrader 5\metaeditor64.exe",
        "${env:ProgramFiles(x86)}\MetaTrader 5\metaeditor64.exe"
    )

    $metaEditor = $metaEditorPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($metaEditor) {
        Start-Process $metaEditor
        Write-Success "MetaEditor abierto"
    } else {
        Write-Error "No se encontró MetaEditor. Ábrelo manualmente."
    }
}
