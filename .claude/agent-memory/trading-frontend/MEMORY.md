# Trading Frontend - Memory

## Ultima actualizacion: 2026-02-24

## Componentes del Backtester

### Pagina Principal
- **Archivo**: `app/(dashboard)/backtester/page.tsx`
- **Descripcion**: UI completa para ejecutar backtests con visualizacion de resultados

### Componentes UI en `components/backtester/`
| Componente | Descripcion |
|------------|-------------|
| `results-summary.tsx` | Resumen de resultados estilo MT5 con estadisticas detalladas |
| `settings-panel.tsx` | Panel de configuracion de parametros del backtest |
| `deals-table.tsx` | Tabla de deals y trades con 3 vistas (Deals, Trades, Report) |
| `equity-graph.tsx` | Grafico de equity curve con canvas |
| `mt5-layout.tsx` | Layout estilo MetaTrader 5 |
| `playback-controls.tsx` | Controles para reproduccion de backtest |
| `journal-panel.tsx` | Panel de journal/log |

## Patrones de UI utilizados

### MetricBox
Componente reutilizable para mostrar metricas con:
- `label`: Etiqueta de la metrica
- `value`: Valor a mostrar
- `positive`: Si el valor es positivo (verde)
- `warning`: Si el valor es de advertencia (amarillo)
- `highlight`: Si debe resaltarse
- `icon`: Icono opcional
- `subtitle`: Texto secundario

```tsx
<MetricBox
  label="Profit"
  value="+109,447€"
  positive={true}
  highlight
  icon="📈"
  subtitle="+1,094%"
/>
```

### Configuracion por defecto del Backtest
```typescript
const defaultConfig: BacktestConfig = {
  strategyName: "Toni (G4)",
  lotajeBase: 0.1,
  numOrders: 1,
  pipsDistance: 10,
  maxLevels: 4,
  takeProfitPips: 20,
  useStopLoss: false,
  useTrailingSL: true,
  trailingSLPercent: 50,
  signalsSource: "signals_simple.csv",
  initialCapital: 10000,
  useRealPrices: false,
};
```

## Metricas mostradas

### Fila 1 (Metricas principales)
1. **Profit Total** - Con porcentaje de retorno
2. **Win Rate** - Con wins/losses
3. **Profit Factor** - Ratio ganancias/perdidas
4. **Max Drawdown** - Con valor en euros

### Fila 2 (Metricas secundarias)
1. **Total Pips** - Pips ganados/perdidos
2. **Trades** - Numero total con promedio
3. **Sharpe** - Sharpe ratio
4. **Expectancy** - Valor esperado por trade
5. **Calmar** - Calmar ratio

### Estadisticas adicionales
- Mejor trade
- Peor trade
- Racha maxima de wins
- Racha maxima de losses

## Estilos CSS personalizados

```css
@keyframes pulse-glow { ... }
@keyframes fade-in { ... }
@keyframes slide-up { ... }
@keyframes shimmer { ... }

.animate-fade-in
.animate-slide-up
.animate-pulse-glow
.trade-row
.trade-row-selected
.metric-value
.btn-execute
```

## Colores utilizados

- **Verde (positivo)**: `#00C853`, `text-green-500`, `bg-green-500/20`
- **Rojo (negativo)**: `#FF5252`, `text-red-500`, `bg-red-500/20`
- **Azul (primary)**: `#0078D4`, `text-blue-500`
- **Ambar (warning)**: `text-amber-500`, `bg-amber-500/20`
- **Morado (optimizer)**: `text-purple-500`, `bg-purple-500`

## API tRPC utilizada

### Queries
- `backtester.getSignalsInfo` - Info de senales disponibles
- `backtester.listSignalSources` - Lista fuentes de senales
- `backtester.getCacheStatus` - Estado del cache de ticks

### Mutations
- `backtester.execute` - Ejecutar backtest sincrono
- `backtester.clearCache` - Limpiar cache de resultados
- `backtester.optimize` - Ejecutar optimizacion de parametros

## Tipos TypeScript

### BacktestConfig
```typescript
interface BacktestConfig {
  strategyName: string;
  lotajeBase: number;
  numOrders: number;
  pipsDistance: number;
  maxLevels: number;
  takeProfitPips: number;
  stopLossPips?: number;
  useStopLoss: boolean;
  useTrailingSL?: boolean;
  trailingSLPercent?: number;
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
  signalsSource?: string;
  initialCapital?: number;
  useRealPrices?: boolean;
  filters?: BacktestFilters;
}
```

### BacktestFilters
```typescript
interface BacktestFilters {
  dateFrom?: string;
  dateTo?: string;
  daysOfWeek?: number[];
  session?: "ASIAN" | "EUROPEAN" | "US" | "ALL";
  side?: "BUY" | "SELL";
}
```

## Fuentes de senales disponibles

1. `signals_simple.csv` - 388 senales (Oct 2025 - Feb 2026)
2. `signals_intradia.csv` - 1516 senales (Ago 2024 - Ene 2026)

## Resultados de ejemplo

Con grid 20x20 en signals_intradia.csv:
- Profit: +109,447€
- Win Rate: 71.6%
- Total Trades: 1516
- Ticks disponibles: 116M

## Optimizaciones implementadas

1. **Cache de resultados** - Los backtests se guardan en cache por configuracion
2. **Batch loading de ticks** - Carga eficiente desde SQLite
3. **Indicador "Desde cache"** - Muestra cuando el resultado viene del cache
4. **Tiempo de ejecucion** - Muestra cuanto tardo el backtest
