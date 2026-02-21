# PRD: Gráfico Tipo MT5 para Backtester

## Objetivo
Implementar un gráfico interactivo tipo MT5 que permita visualizar la operativa de cada señal con reproducción en tiempo real y velocidad ajustable.

## Principio Clave
**NO ROMPER CODIGO EXISTENTE**. Todo el código nuevo será aditivo:
- Nuevos archivos, no modificaciones de lógica existente
- Solo añadir secciones en UI, no reescribir componentes

---

## Arquitectura

### Nuevos Archivos
```
lib/
  ticks-to-candles.ts     # NUEVO: Convierte ticks a velas OHLC

components/
  backtest-chart.tsx      # NUEVO: Componente del gráfico
  chart-controls.tsx      # NUEVO: Controles play/pause/velocidad

app/(dashboard)/backtester/
  page.tsx                # MODIFICAR: Solo añadir sección gráfico
```

### Dependencias
```bash
npm install lightweight-charts
```

---

## Fase 1: Conversión Ticks → Velas

### Archivo: `lib/ticks-to-candles.ts`

```typescript
export type Timeframe = "1" | "5" | "15" | "60"; // minutos

export interface Candle {
  time: number;      // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

/**
 * Convierte array de ticks a velas OHLC
 * @param ticks - Array de ticks ordenados por timestamp
 * @param timeframeMinutes - Intervalo en minutos (1, 5, 15, 60)
 */
export function ticksToCandles(
  ticks: Tick[],
  timeframeMinutes: Timeframe
): Candle[] {
  if (ticks.length === 0) return [];

  const intervalMs = parseInt(timeframeMinutes) * 60 * 1000;
  const candles: Candle[] = [];
  let currentCandle: Partial<Candle> | null = null;

  for (const tick of ticks) {
    const timestamp = new Date(tick.timestamp).getTime();
    const candleTime = Math.floor(timestamp / intervalMs) * intervalMs;
    const price = (tick.bid + tick.ask) / 2; // Mid price

    if (!currentCandle || currentCandle.time !== candleTime) {
      // Guardar vela anterior
      if (currentCandle && currentCandle.time !== undefined) {
        candles.push(currentCandle as Candle);
      }
      // Iniciar nueva vela
      currentCandle = {
        time: Math.floor(candleTime / 1000), // Unix seconds para Lightweight Charts
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
      };
    } else {
      // Actualizar vela actual
      currentCandle.high = Math.max(currentCandle.high!, price);
      currentCandle.low = Math.min(currentCandle.low!, price);
      currentCandle.close = price;
      currentCandle.volume = (currentCandle.volume || 0) + 1;
    }
  }

  // Añadir última vela
  if (currentCandle && currentCandle.time !== undefined) {
    candles.push(currentCandle as Candle);
  }

  return candles;
}

/**
 * Genera velas progressivamente para animación
 */
export function* candlesIterator(
  ticks: Tick[],
  timeframeMinutes: Timeframe
): Generator<{ candle: Candle; isComplete: boolean; tickIndex: number }> {
  const intervalMs = parseInt(timeframeMinutes) * 60 * 1000;
  let currentCandle: Partial<Candle> | null = null;
  let currentCandleTime: number | null = null;

  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    const timestamp = new Date(tick.timestamp).getTime();
    const candleTime = Math.floor(timestamp / intervalMs) * intervalMs;
    const price = (tick.bid + tick.ask) / 2;

    if (currentCandleTime !== candleTime) {
      // Nueva vela
      if (currentCandle) {
        yield {
          candle: currentCandle as Candle,
          isComplete: true,
          tickIndex: i,
        };
      }
      currentCandleTime = candleTime;
      currentCandle = {
        time: Math.floor(candleTime / 1000),
        open: price,
        high: price,
        low: price,
        close: price,
      };
    } else {
      // Actualizar vela
      currentCandle!.high = Math.max(currentCandle!.high!, price);
      currentCandle!.low = Math.min(currentCandle!.low!, price);
      currentCandle!.close = price;
    }

    // Yield vela en progreso
    yield {
      candle: currentCandle as Candle,
      isComplete: false,
      tickIndex: i,
    };
  }

  // Última vela
  if (currentCandle) {
    yield {
      candle: currentCandle as Candle,
      isComplete: true,
      tickIndex: ticks.length - 1,
    };
  }
}
```

---

## Fase 2: Componente Gráfico

### Archivo: `components/backtest-chart.tsx`

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  CrosshairMode,
  ColorType,
} from "lightweight-charts";
import { Candle, Timeframe, ticksToCandles, ticksIterator } from "@/lib/ticks-to-candles";

interface TradeLevel {
  level: number;
  openPrice: number;
  closePrice: number;
  openTime: Date;
  closeTime: Date;
}

interface TradeDetail {
  signalTimestamp: Date;
  signalSide: "BUY" | "SELL";
  signalPrice: number;
  entryPrice: number;
  entryTime: Date;
  exitPrice: number;
  exitTime: Date;
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL";
  levels: TradeLevel[];
}

interface BacktestChartProps {
  ticks: Array<{ timestamp: Date; bid: number; ask: number; spread: number }>;
  trade: TradeDetail;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
}

const PIP_VALUE = 0.10;

export default function BacktestChart({ ticks, trade, config }: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("5");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  const speedOptions = [1, 2, 5, 10, 20, 50, 100];

  // Inicializar gráfico
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: "#1a1a2e" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#2a2a3e" },
        horzLines: { color: "#2a2a3e" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#758696",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2962ff",
        },
        horzLine: {
          color: "#758696",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2962ff",
        },
      },
      rightPriceScale: {
        borderColor: "#2a2a3e",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#2a2a3e",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Responsive
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Cargar velas cuando cambia timeframe
  useEffect(() => {
    if (!candleSeriesRef.current || ticks.length === 0) return;

    const candles = ticksToCandles(ticks, timeframe);
    candleSeriesRef.current.setData(candles as CandlestickData<Time>[]);

    // Añadir marcadores y líneas
    addMarkersAndLines();

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [ticks, timeframe]);

  // Añadir marcadores de entrada/salida y líneas
  const addMarkersAndLines = useCallback(() => {
    if (!candleSeriesRef.current || !chartRef.current) return;

    const isBuy = trade.signalSide === "BUY";
    const entryTime = Math.floor(new Date(trade.entryTime).getTime() / 1000) as Time;
    const exitTime = Math.floor(new Date(trade.exitTime).getTime() / 1000) as Time;

    // Marcadores
    const markers = [
      {
        time: entryTime,
        position: isBuy ? "belowBar" : "aboveBar",
        color: isBuy ? "#26a69a" : "#ef5350",
        shape: isBuy ? "arrowUp" : "arrowDown",
        text: `${trade.signalSide} @ ${trade.entryPrice.toFixed(2)}`,
      },
      {
        time: exitTime,
        position: trade.exitReason === "TAKE_PROFIT" ? "aboveBar" : "belowBar",
        color: trade.exitReason === "TAKE_PROFIT" ? "#26a69a" :
               trade.exitReason === "TRAILING_SL" ? "#ff9800" : "#ef5350",
        shape: "circle",
        text: `${trade.exitReason} @ ${trade.exitPrice.toFixed(2)}`,
      },
    ];

    candleSeriesRef.current.setMarkers(markers);

    // Líneas de precio
    // Take Profit
    const tpPrice = isBuy
      ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
      : trade.entryPrice - config.takeProfitPips * PIP_VALUE;

    candleSeriesRef.current.createPriceLine({
      price: tpPrice,
      color: "#26a69a",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "TP",
    });

    // Niveles de promedio
    const colors = ["#9c27b0", "#2196f3", "#ff9800", "#4caf50"];
    trade.levels.forEach((level, index) => {
      candleSeriesRef.current?.createPriceLine({
        price: level.openPrice,
        color: colors[index % colors.length],
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: `L${level.level}`,
      });
    });
  }, [trade, config]);

  // Reproducción animada
  useEffect(() => {
    if (!isPlaying || !candleSeriesRef.current || ticks.length === 0) return;

    const iterator = ticksIterator(ticks, timeframe);
    const intervalMs = 100 / speed; // Velocidad: 100ms base / speed

    const interval = setInterval(() => {
      const result = iterator.next();

      if (result.done) {
        setIsPlaying(false);
        clearInterval(interval);
        return;
      }

      const { candle, tickIndex } = result.value;

      // Actualizar vela en el gráfico
      candleSeriesRef.current?.update(candle as CandlestickData<Time>);

      // Actualizar precio actual
      setCurrentPrice(candle.close);

      // Actualizar progreso
      setProgress((tickIndex / ticks.length) * 100);

    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speed, ticks, timeframe]);

  // Reset cuando cambia trade
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentPrice(null);

    // Recargar velas completas
    if (candleSeriesRef.current && ticks.length > 0) {
      const candles = ticksToCandles(ticks, timeframe);
      candleSeriesRef.current.setData(candles as CandlestickData<Time>[]);
      addMarkersAndLines();
      chartRef.current?.timeScale().fitContent();
    }
  }, [trade]);

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800 rounded-lg">
        {/* Timeframe */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Timeframe:</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            className="px-2 py-1 bg-slate-700 rounded text-sm"
          >
            <option value="1">M1</option>
            <option value="5">M5</option>
            <option value="15">M15</option>
            <option value="60">H1</option>
          </select>
        </div>

        {/* Velocidad */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Velocidad:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 rounded text-sm"
          >
            {speedOptions.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-4 py-1 rounded ${isPlaying ? "bg-red-600" : "bg-green-600"}`}
        >
          {isPlaying ? "⏸ Pausar" : "▶ Reproducir"}
        </button>

        {/* Reset */}
        <button
          onClick={() => {
            setIsPlaying(false);
            setProgress(0);
            if (candleSeriesRef.current && ticks.length > 0) {
              const candles = ticksToCandles(ticks, timeframe);
              candleSeriesRef.current.setData(candles as CandlestickData<Time>[]);
              addMarkersAndLines();
              chartRef.current?.timeScale().fitContent();
            }
          }}
          className="px-4 py-1 bg-slate-600 rounded"
        >
          ⟲ Reset
        </button>

        {/* Info */}
        {currentPrice && (
          <div className="ml-auto text-sm">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono">{currentPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Gráfico */}
      <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />

      {/* Info del trade */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-slate-800 rounded-lg text-sm">
        <div>
          <span className="text-gray-400">Side:</span>
          <span className={`ml-2 font-bold ${trade.signalSide === "BUY" ? "text-green-400" : "text-red-400"}`}>
            {trade.signalSide}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Entrada:</span>
          <span className="ml-2 font-mono">{trade.entryPrice.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-400">Salida:</span>
          <span className="ml-2 font-mono">{trade.exitPrice.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-400">Cierre:</span>
          <span className={`ml-2 ${
            trade.exitReason === "TAKE_PROFIT" ? "text-green-400" :
            trade.exitReason === "TRAILING_SL" ? "text-yellow-400" : "text-red-400"
          }`}>
            {trade.exitReason}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

## Fase 3: Endpoint para obtener ticks de un trade

### Modificar: `server/api/trpc/routers/backtester.ts`

Añadir nuevo endpoint (NO modificar existentes):

```typescript
/**
 * Obtiene los ticks para un trade específico
 */
getTradeTicks: procedure
  .input(z.object({
    signalTimestamp: z.date(),
    closeTimestamp: z.date().optional(),
    signalLimit: z.number().optional(),
  }))
  .query(async ({ input }) => {
    const dbReady = await isTicksDBReady();

    if (!dbReady) {
      return { ticks: [], hasRealTicks: false };
    }

    const endTime = input.closeTimestamp
      ? new Date(Math.min(input.closeTimestamp.getTime(), input.signalTimestamp.getTime() + 24 * 60 * 60 * 1000))
      : new Date(input.signalTimestamp.getTime() + 24 * 60 * 60 * 1000);

    const ticks = await getTicksFromDB(input.signalTimestamp, endTime);

    return {
      ticks,
      hasRealTicks: ticks.length > 0,
    };
  }),
```

---

## Fase 4: Integrar en UI

### Modificar: `app/(dashboard)/backtester/page.tsx`

Añadir DESPUÉS del detalle de trades (no reemplazar nada):

```typescript
// Añadir imports
import BacktestChart from "@/components/backtest-chart";

// Añadir estado para trade seleccionado
const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);
const [tradeTicks, setTradeTicks] = useState<any[]>([]);

// Añadir query para obtener ticks
const tradeTicksQuery = trpc.backtester.getTradeTicks.useQuery(
  {
    signalTimestamp: results?.tradeDetails?.[selectedTradeIndex ?? 0]?.signalTimestamp ?? new Date(),
    closeTimestamp: results?.tradeDetails?.[selectedTradeIndex ?? 0]?.exitTime,
  },
  { enabled: selectedTradeIndex !== null && !!results?.tradeDetails?.[selectedTradeIndex] }
);

// Añadir sección de gráfico AL FINAL, antes de </div>
{/* Gráfico de trade */}
{results?.tradeDetails && results.tradeDetails.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle>Visualización de Trade</CardTitle>
      <CardDescription>
        Selecciona un trade para ver el gráfico
      </CardDescription>
    </CardHeader>
    <CardContent>
      {/* Selector de trade */}
      <div className="mb-4">
        <select
          value={selectedTradeIndex ?? ""}
          onChange={(e) => setSelectedTradeIndex(Number(e.target.value))}
          className="w-full px-3 py-2 bg-slate-700 rounded"
        >
          <option value="">Selecciona un trade...</option>
          {results.tradeDetails.map((trade: any, i: number) => (
            <option key={i} value={i}>
              #{i + 1} - {trade.signalSide} @ {trade.signalPrice.toFixed(2)} -
              {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit.toFixed(0)}€
            </option>
          ))}
        </select>
      </div>

      {/* Gráfico */}
      {selectedTradeIndex !== null && results.tradeDetails[selectedTradeIndex] && (
        <BacktestChart
          ticks={tradeTicksQuery.data?.ticks || []}
          trade={results.tradeDetails[selectedTradeIndex]}
          config={{
            takeProfitPips: config.takeProfitPips,
            pipsDistance: config.pipsDistance,
            maxLevels: config.maxLevels,
          }}
        />
      )}

      {/* Mensaje si no hay ticks */}
      {selectedTradeIndex !== null && tradeTicksQuery.data && !tradeTicksQuery.data.hasRealTicks && (
        <p className="text-yellow-500 text-center py-8">
          No hay ticks reales disponibles para este trade. El gráfico mostrará velas sintéticas.
        </p>
      )}
    </CardContent>
  </Card>
)}
```

---

## Orden de Implementación (Ralph Loop)

1. **Instalar lightweight-charts** (`npm install lightweight-charts`)
2. **Crear** `lib/ticks-to-candles.ts`
3. **Crear** `components/backtest-chart.tsx`
4. **Añadir endpoint** `getTradeTicks` en backtester router
5. **Añadir sección** gráfico en UI
6. **Probar** que todo funciona
7. **Commit**

---

## Notas Importantes

- NO modificar la lógica existente del motor de backtesting
- NO modificar los tipos existentes (solo añadir nuevos si necesario)
- El gráfico es 100% aditivo
- Si hay errores, fixear sin reescribir

---

*Documento creado: 2026-02-21*
*Para Ralph Loop autónomo*
