param(
    [int]$MaxIterations = 20,
    [int]$DelaySeconds = 5,
    [switch]$Monitor
)

$LogFile = Join-Path $PSScriptRoot "ralph-chart.log"
$ProjectDir = $PSScriptRoot

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    if ($Monitor) { Write-Host $logEntry }
}

Write-Log "=== RALPH CHART LOOP INICIADO ==="
Write-Log "Directorio: $ProjectDir"
Write-Log "Max iteraciones: $MaxIterations"
Write-Log "Objetivo: Implementar grafico tipo MT5"

# PROMPT PARA IMPLEMENTAR GRAFICO
$prompt = @"
Eres un agente de desarrollo autonomo implementando un grafico tipo MT5 para el backtester de trading.

== PASO 1: LEER ESPECIFICACIONES ==
LEE ESTOS ARCHIVOS OBLIGATORIOS:
- Read .ralph/specs/PRD-CHART.md (especificacion completa)
- Read .ralph/PROMPT-CHART.md (orden de prioridad)
- Read CLAUDE.md (contexto del proyecto)

== PASO 2: VERIFICAR ESTADO ACTUAL ==
EJECUTA:
- git status
- ls lib/ (ver que archivos existen)
- ls components/ (ver que componentes existen)

== PASO 3: SEGUIR ORDEN DE PRIIDAD DEL PROMPT-CHART.md ==
El orden es:
1. npm install lightweight-charts
2. Crear lib/ticks-to-candles.ts
3. Crear components/backtest-chart.tsx
4. Añadir endpoint getTradeTicks en router
5. Integrar en UI
6. Probar y fixear

== PASO 4: IMPLEMENTAR ==
Implementa la SIGUIENTE tarea pendiente segun el orden de prioridad.
- Si el paso 1 esta hecho, pasa al 2
- Si el 2 esta hecho, pasa al 3
- etc.

== PASO 5: COMMIT ==
Despues de implementar cada feature, haz commit:
- git add <archivos modificados>
- git commit -m "feat: descripcion en espanol"

== PASO 6: VERIFICAR TIPOS ==
Despues de cada cambio:
- npx tsc --noEmit
- Si hay errores, fixealos antes de commit

== PASO 7: COMPLETADO ==
Cuando TODOS los pasos esten implementados y funcionando, responde: RALPH_CHART_COMPLETE

== REGLAS CRITICAS ==
- NO romper codigo existente - SOLO AÑADIR
- NO reescribir componentes - crear nuevos
- NO modificar logica del motor de backtesting
- Un feature = un commit
- Mensajes en espanol
- Si hay errores, fixealos y continua
- Leer PRD-CHART.md para especificaciones detalladas

Directorio del proyecto: C:\Users\guill\Projects\trading-bot-saas
"@

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Log "--- Iteracion $i de $MaxIterations ---"
    try {
        $cmd = 'set "CLAUDECODE=" && claude -p "' + $prompt.Replace('"', '""') + '" --model glm-5 --allowedTools "Bash,Read,Edit,Write,Glob,Grep" --dangerously-skip-permissions'
        $output = & cmd /c $cmd 2>&1 | Out-String
        Write-Log "Output (1000 chars): $($output.Substring(0, [Math]::Min(1000, $output.Length)))"
        if ($output -match "RALPH_CHART_COMPLETE") {
            Write-Log "=== RALPH_CHART_COMPLETE - Grafico implementado en $i iteraciones ==="
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
Write-Log "=== RALPH CHART LOOP FINALIZADO ==="
