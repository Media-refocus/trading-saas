# Ejecutar 30 estrategias con señales intradía (1516 señales)
# Endpoint: backtester.execute (OPTIMIZADO con cache)

$ResultsDir = "backtest_results_intradia"
$LogFile = "backtests-intradia.log"
$BaseUrl = "http://localhost:3000"
$SignalFile = "signals_intradia.csv"

# Crear directorio de resultados
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

# Inicializar log
"" | Out-File $LogFile

# 30 Estrategias a probar
$Strategies = @(
    @{Num=1;  Name="GRID_8";       Grupo="GRID_BASICO";   Config=@{strategyName="GRID_8";       pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=2;  Name="GRID_10";      Grupo="GRID_BASICO";   Config=@{strategyName="GRID_10";      pipsDistance=10; maxLevels=30; takeProfitPips=10; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=3;  Name="GRID_12";      Grupo="GRID_BASICO";   Config=@{strategyName="GRID_12";      pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=4;  Name="GRID_15";      Grupo="GRID_BASICO";   Config=@{strategyName="GRID_15";      pipsDistance=15; maxLevels=20; takeProfitPips=15; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=5;  Name="GRID_20";      Grupo="GRID_BASICO";   Config=@{strategyName="GRID_20";      pipsDistance=20; maxLevels=15; takeProfitPips=20; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=6;  Name="GRID_SL_50";   Grupo="GRID_SL";       Config=@{strategyName="GRID_SL_50";   pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=50;  signalsSource=$SignalFile}},
    @{Num=7;  Name="GRID_SL_100";  Grupo="GRID_SL";       Config=@{strategyName="GRID_SL_100";  pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=100; signalsSource=$SignalFile}},
    @{Num=8;  Name="GRID_SL_200";  Grupo="GRID_SL";       Config=@{strategyName="GRID_SL_200";  pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=200; signalsSource=$SignalFile}},
    @{Num=9;  Name="GRID_SL_DIN";  Grupo="GRID_SL";       Config=@{strategyName="GRID_SL_DIN";  pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=150; signalsSource=$SignalFile}},
    @{Num=10; Name="GRID_TRAIL";   Grupo="GRID_SL";       Config=@{strategyName="GRID_TRAIL";   pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=100; signalsSource=$SignalFile}},
    @{Num=11; Name="MULTI_2";      Grupo="MULTI_ORDER";   Config=@{strategyName="MULTI_2";      pipsDistance=10; maxLevels=25; takeProfitPips=10; lotajeBase=0.02; numOrders=2; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=12; Name="MULTI_3";      Grupo="MULTI_ORDER";   Config=@{strategyName="MULTI_3";      pipsDistance=12; maxLevels=20; takeProfitPips=12; lotajeBase=0.02; numOrders=3; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=13; Name="MULTI_2_TIGHT";Grupo="MULTI_ORDER";   Config=@{strategyName="MULTI_2_TIGHT";pipsDistance=6;  maxLevels=40; takeProfitPips=6;  lotajeBase=0.02; numOrders=2; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=14; Name="MULTI_3_TIGHT";Grupo="MULTI_ORDER";   Config=@{strategyName="MULTI_3_TIGHT";pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.02; numOrders=3; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=15; Name="SCALP_5";      Grupo="SCALPING";      Config=@{strategyName="SCALP_5";      pipsDistance=5;  maxLevels=45; takeProfitPips=5;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=16; Name="SCALP_8";      Grupo="SCALPING";      Config=@{strategyName="SCALP_8";      pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=17; Name="SCALP_AGR";    Grupo="SCALPING";      Config=@{strategyName="SCALP_AGR";    pipsDistance=5;  maxLevels=50; takeProfitPips=5;  lotajeBase=0.04; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=18; Name="SWING_20";     Grupo="SWING";         Config=@{strategyName="SWING_20";     pipsDistance=20; maxLevels=15; takeProfitPips=20; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=19; Name="SWING_30";     Grupo="SWING";         Config=@{strategyName="SWING_30";     pipsDistance=30; maxLevels=12; takeProfitPips=30; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=20; Name="SWING_50";     Grupo="SWING";         Config=@{strategyName="SWING_50";     pipsDistance=50; maxLevels=10; takeProfitPips=50; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=21; Name="SMART_BASE";   Grupo="SMART";         Config=@{strategyName="SMART_BASE";   pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=22; Name="SMART_COMP";   Grupo="SMART";         Config=@{strategyName="SMART_COMP";   pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=23; Name="SMART_REENTRY";Grupo="SMART";         Config=@{strategyName="SMART_REENTRY";pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=24; Name="SMART_DYN";    Grupo="SMART";         Config=@{strategyName="SMART_DYN";    pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=25; Name="SMART_RISK";   Grupo="SMART";         Config=@{strategyName="SMART_RISK";   pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=26; Name="CONSERV_5";    Grupo="CONSERVADOR";   Config=@{strategyName="CONSERV_5";    pipsDistance=15; maxLevels=10; takeProfitPips=15; lotajeBase=0.01; numOrders=1; useStopLoss=$true;  stopLossPips=100; signalsSource=$SignalFile}},
    @{Num=27; Name="CONSERV_10";   Grupo="CONSERVADOR";   Config=@{strategyName="CONSERV_10";   pipsDistance=20; maxLevels=8;  takeProfitPips=20; lotajeBase=0.01; numOrders=1; useStopLoss=$true;  stopLossPips=80;  signalsSource=$SignalFile}},
    @{Num=28; Name="CONSERV_PROM"; Grupo="CONSERVADOR";   Config=@{strategyName="CONSERV_PROM"; pipsDistance=25; maxLevels=6;  takeProfitPips=25; lotajeBase=0.01; numOrders=1; useStopLoss=$true;  stopLossPips=60;  signalsSource=$SignalFile}},
    @{Num=29; Name="AGRESIVO_1";   Grupo="AGRESIVO";      Config=@{strategyName="AGRESIVO_1";   pipsDistance=8;  maxLevels=40; takeProfitPips=8;  lotajeBase=0.04; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}},
    @{Num=30; Name="AGRESIVO_2";   Grupo="AGRESIVO";      Config=@{strategyName="AGRESIVO_2";   pipsDistance=6;  maxLevels=45; takeProfitPips=6;  lotajeBase=0.05; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile}}
)

function Log-Write {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    Write-Host $logEntry
}

function Run-Backtest {
    param(
        [int]$StrategyNum,
        [string]$StrategyName,
        [hashtable]$Config
    )

    # Estructura correcta para tRPC
    $body = @{
        json = @{
            config = $Config
        }
    } | ConvertTo-Json -Depth 10

    $url = "$BaseUrl/api/trpc/backtester.execute"

    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 600

        $results = $response.result.data.json.results
        $fromCache = $response.result.data.json.fromCache
        $elapsedMs = $response.result.data.json.elapsedMs
        $trades = $results.totalTrades
        $profit = $results.totalProfit
        $maxDD = $results.maxDrawdown

        return @{
            Success = $true
            Trades = $trades
            Profit = $profit
            MaxDD = $maxDD
            Results = $results
            FromCache = $fromCache
            ElapsedMs = $elapsedMs
        }
    } catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Verificar que el servidor está corriendo
Log-Write "Verificando servidor..."
try {
    $healthCheck = Invoke-RestMethod -Uri "$BaseUrl/api/trpc/backtester.getCacheStatus" -TimeoutSec 5
    $cacheStatus = $healthCheck.result.data.json
    Log-Write "Cache de ticks: $($cacheStatus.isLoaded) ($($cacheStatus.totalTicks) ticks, $($cacheStatus.totalDays) dias)"
} catch {
    Log-Write "ERROR: El servidor no está corriendo. Ejecuta 'npm run dev' primero."
    exit 1
}

# Main
Log-Write "=== INICIANDO BACKTESTS CON 1516 SENALES INTRADIA (OPTIMIZADO) ==="
Log-Write "Archivo de senales: $SignalFile"
Log-Write "Total estrategias: $($Strategies.Count)"

$allResults = @()
$successCount = 0
$errorCount = 0
$cacheHits = 0
$totalTime = 0

foreach ($strategy in $Strategies) {
    $num = $strategy.Num
    $name = $strategy.Name
    $grupo = $strategy.Grupo
    $config = $strategy.Config

    Log-Write "Ejecutando estrategia $num/$($Strategies.Count): $name"

    $result = Run-Backtest -StrategyNum $num -StrategyName $name -Config $config

    if ($result.Success) {
        $cacheLabel = if ($result.FromCache) { "(CACHE)" } else { "" }
        $timeLabel = "$($result.ElapsedMs)ms"
        Log-Write "  OK $cacheLabel - Trades: $($result.Trades), Profit: `$$($result.Profit), Max DD: `$$($result.MaxDD) [$timeLabel]"
        $successCount++

        if ($result.FromCache) { $cacheHits++ }
        $totalTime += $result.ElapsedMs

        # Guardar resultado individual
        $resultFile = "$ResultsDir/estrategia_${num}_${name}.json"
        $result.Results | ConvertTo-Json -Depth 10 | Out-File $resultFile

        $allResults += [PSCustomObject]@{
            Num = $num
            Name = $name
            Grupo = $grupo
            Trades = $result.Trades
            Profit = $result.Profit
            MaxDD = $result.MaxDD
            ElapsedMs = $result.ElapsedMs
            FromCache = $result.FromCache
        }
    } else {
        Log-Write "  ERROR: $($result.Error)"
        $errorCount++
    }
}

# Guardar resumen
$summaryFile = "$ResultsDir/summary.json"
$allResults | ConvertTo-Json | Out-File $summaryFile

# Ranking por profit
$ranking = $allResults | Sort-Object Profit -Descending
$rank = 0

$rankingFile = "$ResultsDir/ranking_profit.md"
$rankingContent = "# Ranking por Profit (1516 senales intradia - OPTIMIZADO)`n`n"
$rankingContent += "Tiempo total: $([math]::Round($totalTime / 1000, 2))s | Cache hits: $cacheHits/$($Strategies.Count)`n`n"
$rankingContent += "| Pos | Estrategia | Grupo | Profit | Trades | Max DD | Tiempo |`n"
$rankingContent += "|-----|-----------|-------|--------|--------|--------|--------|`n"
foreach ($r in $ranking) {
    $rank++
    $cacheMark = if ($r.FromCache) { "*" } else { "" }
    $rankingContent += "| $rank | $($r.Name) | $($r.Grupo) | `$$($r.Profit) | $($r.Trades) | `$$($r.MaxDD) | $([math]::Round($r.ElapsedMs / 1000, 2))s$cacheMark |`n"
}
$rankingContent | Out-File $rankingFile -Encoding UTF8

Log-Write "=== BACKTESTS COMPLETADOS ==="
Log-Write "Exitosos: $successCount"
Log-Write "Errores: $errorCount"
Log-Write "Cache hits: $cacheHits"
Log-Write "Tiempo total: $([math]::Round($totalTime / 1000, 2))s"
Log-Write "Resultados guardados en: $ResultsDir"
