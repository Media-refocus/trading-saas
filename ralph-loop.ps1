param(
    [int]$MaxIterations = 50,
    [int]$DelaySeconds = 10,
    [switch]$Monitor
)

$LogFile = Join-Path $PSScriptRoot "ralph-loop.log"
$ProjectDir = $PSScriptRoot

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    if ($Monitor) { Write-Host $logEntry }
}

Write-Log "=== RALPH LOOP INICIADO ==="
Write-Log "Directorio: $ProjectDir"
Write-Log "Max iteraciones: $MaxIterations"

# PROMPT DIRECTO PARA GLM-5
$prompt = @"
Eres un agente de desarrollo autonomo en un loop Ralph. Tu trabajo es ejecutar backtests con diferentes estrategias.

== PASO 1: LEER ARCHIVOS OBLIGATORIOS ==
EJECUTA ESTOS COMANDOS YA:
- Read .ralph/PROMPT.md
- Read .ralph/specs/STRATEGY_OPTIMIZATION.md
- Read CLAUDE.md

== PASO 2: VERIFICAR ESTADO ==
EJECUTA:
- ls backtest_results/ (ver que estrategias ya estan ejecutadas)
- git log --oneline -5

== PASO 3: EJECUTAR SIGUIENTE ESTRATEGIA ==
Segun el orden de prioridad en PROMPT.md, ejecuta la SIGUIENTE estrategia pendiente usando curl:
- Si la estrategia 1 esta hecha, pasa a la 2
- Si la 2 esta hecha, pasa a la 3, etc.

El servidor Next.js esta corriendo en http://localhost:3000

== PASO 4: GUARDAR RESULTADO ==
Guarda el resultado en backtest_results/{strategyName}.json

== PASO 5: COMMIT ==
Despues de ejecutar, haz commit:
- git add backtest_results/
- git commit -m "feat: ejecutar estrategia {nombre}"

== PASO 6: VERIFICAR COMPLETITUD ==
Si TODAS las 10 estrategias estan ejecutadas Y los 5 archivos de analisis estan generados, responde SOLO: RALPH_COMPLETE

== REGLAS ==
- NO preguntes que hacer - ACTUA
- NO esperes confirmacion - EJECUTA
- Una estrategia = un commit
- Mensajes en español
- Si hay errores, fixealos y continua
- El servidor ya esta corriendo en localhost:3000
"@

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Log "--- Iteracion $i de $MaxIterations ---"
    try {
        # Quitar CLAUDECODE para permitir ejecutar dentro de Claude Code
        $cmd = 'set "CLAUDECODE=" && claude -p "' + $prompt.Replace('"', '""') + '" --model glm-5 --allowedTools "Bash,Read,Edit,Write,Glob,Grep" --dangerously-skip-permissions'
        $output = & cmd /c $cmd 2>&1 | Out-String
        Write-Log "Output (800 chars): $($output.Substring(0, [Math]::Min(800, $output.Length)))"
        if ($output -match "RALPH_COMPLETE") {
            Write-Log "=== RALPH_COMPLETE - Proyecto completado en $i iteraciones ==="
            break
        }
    } catch {
        Write-Log "ERROR: $_"
    }
    if ($i -lt $MaxIterations) {
        Write-Log "Esperando ${DelaySeconds}s..."
        Start-Sleep -Seconds $DelaySeconds
    }
}
Write-Log "=== RALPH LOOP FINALIZADO ==="
