param(
    [int]$MaxIterations = 30,
    [int]$DelaySeconds = 15,
    [switch]$Monitor
)

$LogFile = Join-Path $PSScriptRoot "ralph-chart-v2.log"
$ProjectDir = $PSScriptRoot

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    if ($Monitor) { Write-Host $logEntry }
}

Write-Log "=== RALPH LOOP CHART V2 INICIADO ==="
Write-Log "Directorio: $ProjectDir"
Write-Log "Max iteraciones: $MaxIterations"

# PROMPT DIRECTO PARA GLM-5
$prompt = @"
Eres un agente de desarrollo autonomo en un loop Ralph. Tu trabajo es implementar features una por una.

== PASO 1: LEER ARCHIVOS OBLIGATORIOS ==
EJECUTA ESTOS COMANDOS YA:
- Read .ralph/PROMPT-CHART-V2.md
- Read components/simple-candle-chart.tsx

== PASO 2: VERIFICAR ESTADO ==
EJECUTA:
- git log --oneline -5
- git status

== PASO 3: IMPLEMENTAR SIGUIENTE FEATURE ==
Segun el orden de prioridad en PROMPT-CHART-V2.md, implementa la SIGUIENTE feature pendiente.
- Si la feature 1 esta hecha, pasa a la 2
- Si la 2 esta hecha, pasa a la 3

== PASO 4: COMMIT ==
Despues de implementar, haz commit:
- git add <archivos>
- git commit -m "feat: descripcion en espanol"

== PASO 5: VERIFICAR COMPLETITUD ==
Si TODAS las features del PROMPT estan implementadas, responde SOLO: RALPH_CHART_V2_COMPLETE

== REGLAS ==
- NO preguntes que hacer - ACTUA
- NO esperes confirmacion - IMPLEMENTA
- Un feature = un commit
- Mensajes en espanol
- Si hay errores, fixealos y continua
- Verifica que el codigo compile antes de commit
"@

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Log "--- Iteracion $i de $MaxIterations ---"
    try {
        # Quitar CLAUDECODE para permitir ejecutar dentro de Claude Code
        $cmd = 'set "CLAUDECODE=" && claude -p "' + $prompt.Replace('"', '""') + '" --model glm-5 --allowedTools "Bash,Read,Edit,Write,Glob,Grep" --dangerously-skip-permissions'
        $output = & cmd /c $cmd 2>&1 | Out-String
        Write-Log "Output (800 chars): $($output.Substring(0, [Math]::Min(800, $output.Length)))"
        if ($output -match "RALPH_CHART_V2_COMPLETE") {
            Write-Log "=== RALPH_CHART_V2_COMPLETE - Proyecto completado en $i iteraciones ==="
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
Write-Log "=== RALPH LOOP CHART V2 FINALIZADO ==="
