# Ralph Loop - Gráfico Tipo MT5

## Instrucciones por Iteración

Eres un agente de desarrollo autónomo implementando el gráfico tipo MT5 para el backtester de trading.

---

## Orden de Prioridad (SEGUIR ESTRICTAMENTE)

### 1. Instalar dependencia
```bash
cd C:\Users\guill\Projects\trading-bot-saas
npm install lightweight-charts
```
**Commit**: "chore: instalar lightweight-charts"

### 2. Crear lib/ticks-to-candles.ts
- Implementar función `ticksToCandles()`
- Implementar generador `candlesIterator()`
- Tipos: `Timeframe`, `Candle`
**Commit**: "feat: funcion ticks a velas OHLC"

### 3. Crear components/backtest-chart.tsx
- Componente con Lightweight Charts
- Controles: timeframe, velocidad, play/pause
- Marcadores de entrada/salida
- Líneas de niveles y TP
**Commit**: "feat: componente grafico tipo MT5"

### 4. Añadir endpoint getTradeTicks en router
- En `server/api/trpc/routers/backtester.ts`
- Añadir NUEVO endpoint (no modificar existentes)
**Commit**: "feat: endpoint para obtener ticks de trade"

### 5. Integrar en UI
- En `app/(dashboard)/backtester/page.tsx`
- Añadir sección al FINAL (no reemplazar nada)
- Selector de trade
- Renderizar BacktestChart
**Commit**: "feat: integrar grafico en UI del backtester"

### 6. Probar y fixear
- Si hay errores de TypeScript, fixear
- Si hay errores de import, fixear
- NO reescribir código existente

### 7. Commit final cuando todo funcione
**Commit**: "feat: grafico tipo MT5 completo"

---

## Reglas Importantes

1. **NO romper código existente** - Solo añadir
2. **Un feature = un commit**
3. **Mensajes en español**
4. **Si hay error, fixear y continuar**
5. **Leer PRD-CHART.md para especificaciones completas**

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `lib/ticks-to-candles.ts` | CREAR |
| `components/backtest-chart.tsx` | CREAR |
| `server/api/trpc/routers/backtester.ts` | AÑADIR endpoint |
| `app/(dashboard)/backtester/page.tsx` | AÑADIR sección |

---

## Verificación

Antes de cada commit:
- `npx tsc --noEmit` (verificar tipos)
- Si falla, fixear

---

## Completado

Cuando todo funcione, responde: **RALPH_CHART_COMPLETE**

Incluir resumen de:
- Archivos creados
- Archivos modificados
- Features implementadas
