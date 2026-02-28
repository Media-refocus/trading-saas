"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  ColorType,
  CrosshairMode,
  PriceLineSource,
} from "lightweight-charts";
import { getThemeColors } from "@/lib/chart-themes";

// ==================== INTERFACES ====================

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
  totalProfit: number;
  levels: TradeLevel[];
}

interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

interface OHLCCandle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

type Timeframe = "1" | "5" | "15";

// ==================== CONSTANTES ====================

const PIP_VALUE = 0.10;
const LOT_VALUE = 10;
const LEVERAGE = 100;

// ==================== UTILIDADES ====================

function getTimeframeMs(tf: Timeframe): number {
  return parseInt(tf) * 60 * 1000;
}

function getCandleStartTime(timestamp: Date, tf: Timeframe): Date {
  const intervalMs = getTimeframeMs(tf);
  const tickTime = timestamp.getTime();
  return new Date(Math.floor(tickTime / intervalMs) * intervalMs);
}

function getMidPrice(tick: Tick): number {
  return (tick.bid + tick.ask) / 2;
}

// Generar velas OHLC históricas sintéticas antes del trade
function generateHistoryCandles(
  entryPrice: number,
  entryTime: Date,
  count: number,
  tf: Timeframe
): OHLCCandle[] {
  const candles: OHLCCandle[] = [];
  const intervalMs = getTimeframeMs(tf);
  let currentPrice = entryPrice;
  let currentTime = getCandleStartTime(entryTime, tf).getTime() - intervalMs;

  for (let i = 0; i < count; i++) {
    // Random walk con volatilidad realista para XAUUSD
    const volatility = 0.5 + Math.random() * 1.5; // $0.5-$2 por vela
    const trend = (Math.random() - 0.5) * 0.3;
    const open = currentPrice;
    const close = open + trend + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.unshift({
      time: Math.floor(currentTime / 1000) as Time,
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
    currentTime -= intervalMs;
  }

  return candles;
}

// Agregar ticks a velas OHLC
function aggregateTicksToCandles(ticks: Tick[], tf: Timeframe): OHLCCandle[] {
  if (ticks.length === 0) return [];

  const candleMap = new Map<number, OHLCCandle>();

  ticks.forEach((tick) => {
    const price = getMidPrice(tick);
    const candleStart = getCandleStartTime(new Date(tick.timestamp), tf);
    const timeKey = Math.floor(candleStart.getTime() / 1000);

    const existing = candleMap.get(timeKey);
    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    } else {
      candleMap.set(timeKey, {
        time: timeKey as Time,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    }
  });

  return Array.from(candleMap.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

// Generar ticks sintéticos
function generateSyntheticTicks(
  entryPrice: number,
  exitPrice: number,
  entryTime: Date,
  exitTime: Date
): Tick[] {
  const entryTimeMs = entryTime.getTime();
  const exitTimeMs = exitTime.getTime();
  const durationMs = exitTimeMs - entryTimeMs;

  if (durationMs <= 0) return [];

  const avgTickInterval = 300;
  const numTicks = Math.max(100, Math.ceil(durationMs / avgTickInterval));
  const result: Tick[] = [];
  const priceDiff = exitPrice - entryPrice;
  const baseSpread = 0.02;

  let currentPrice = entryPrice;
  let lastTime = entryTimeMs;

  for (let i = 0; i < numTicks; i++) {
    const progress = numTicks > 1 ? i / (numTicks - 1) : 0;
    const targetPrice = entryPrice + priceDiff * progress;
    const trend = (targetPrice - currentPrice) * 0.1;
    const noise = (Math.random() - 0.5) * 0.05;
    currentPrice += trend + noise;

    const spread = baseSpread + (Math.random() - 0.5) * 0.01;
    lastTime += avgTickInterval + (Math.random() - 0.5) * 200;

    result.push({
      timestamp: new Date(lastTime),
      bid: currentPrice,
      ask: currentPrice + spread,
      spread,
    });
  }

  return result;
}

// ==================== COMPONENTE LEVELS STATUS ====================

function LevelsStatus({
  levels,
  currentTick,
  isBuy,
  pipValue,
  levelColors,
}: {
  levels: TradeLevel[];
  currentTick: Tick | null;
  isBuy: boolean;
  pipValue: number;
  levelColors: string[];
}) {
  const currentTimeMs = currentTick ? new Date(currentTick.timestamp).getTime() : Date.now();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {levels.map((level) => {
        const entryTimeMs = levels[0]?.openTime ? new Date(levels[0].openTime).getTime() : 0;
        const openTimeMs = level.openTime
          ? new Date(level.openTime).getTime()
          : level.level === 0 ? entryTimeMs : Infinity;
        const closeTimeMs = level.closeTime ? new Date(level.closeTime).getTime() : Infinity;

        const isOpened = currentTimeMs >= openTimeMs && !isNaN(openTimeMs);
        const isClosed =
          (currentTimeMs >= closeTimeMs && closeTimeMs !== Infinity) ||
          (level.closePrice != null && level.closePrice !== 0);
        const isPending = !isOpened && !isClosed;

        const levelColor =
          level.level === 0
            ? isBuy
              ? "#00c853"
              : "#ff1744"
            : levelColors[(level.level - 1) % levelColors.length];

        let pipsGained = 0;
        if (isClosed && level.closePrice) {
          pipsGained = isBuy
            ? (level.closePrice - level.openPrice) / pipValue
            : (level.openPrice - level.closePrice) / pipValue;
        }

        return (
          <div
            key={level.level}
            className={`p-2 rounded text-xs border ${
              isPending
                ? "border-gray-700 bg-gray-800/50 opacity-50"
                : isClosed
                ? "border-gray-600 bg-gray-800"
                : "border-current"
            }`}
            style={{ borderColor: isClosed || isPending ? undefined : levelColor }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold" style={{ color: levelColor }}>
                {level.level === 0 ? "ENTRY" : `L${level.level}`}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  isPending
                    ? "bg-gray-700 text-gray-400"
                    : isClosed
                    ? "bg-green-900/50 text-green-400"
                    : "bg-blue-900/50 text-blue-400 animate-pulse"
                }`}
              >
                {isPending ? "PENDIENTE" : isClosed ? "CERRADO" : "ACTIVO"}
              </span>
            </div>
            <div className="font-mono text-gray-300">{level.openPrice.toFixed(2)}</div>
            {isClosed && (
              <div className="text-green-400 font-mono mt-1">+{pipsGained.toFixed(1)} pips</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== COMPONENTE PRINCIPAL ====================

function isValidTrade(trade: TradeDetail | null): trade is TradeDetail {
  if (!trade) return false;
  if (trade.entryPrice == null || isNaN(trade.entryPrice)) return false;
  if (trade.exitPrice == null || isNaN(trade.exitPrice)) return false;
  if (!trade.entryTime) return false;
  if (!trade.exitTime) return false;
  if (!trade.signalSide) return false;
  return true;
}

export default function SimpleCandleChart({
  ticks,
  trade,
  config,
  hasRealTicks = true,
  themeId = "mt5",
}: {
  ticks: Tick[];
  trade: TradeDetail | null;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
  hasRealTicks?: boolean;
  themeId?: string;
}) {
  const colors = getThemeColors(themeId);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("1");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [progress, setProgress] = useState(0);
  const [currentTickIndex, setCurrentTickIndex] = useState(0);
  const [allTicks, setAllTicks] = useState<Tick[]>([]);
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [displayedCandles, setDisplayedCandles] = useState<OHLCCandle[]>([]);
  const [historyCandles, setHistoryCandles] = useState<OHLCCandle[]>([]);

  const speedOptions = [1, 2, 5, 10, 20, 50, 100];

  // ==================== INICIALIZACIÓN DEL CHART ====================

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid, style: 1 },
        horzLines: { color: colors.grid, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: colors.text + "50",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: colors.text + "50",
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: colors.grid,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: colors.grid,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      borderUpColor: colors.candleUp,
      borderDownColor: colors.candleDown,
      wickUpColor: colors.wickUp,
      wickDownColor: colors.wickDown,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Responsive
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [colors]);

  // ==================== CARGA DE TICKS ====================

  useEffect(() => {
    if (!trade) {
      setAllTicks([]);
      setDisplayedCandles([]);
      setHistoryCandles([]);
      setCurrentTickIndex(0);
      setProgress(0);
      setIsPlaying(false);
      setCurrentTick(null);
      return;
    }

    try {
      let loadedTicks: Tick[] = [];
      if (ticks && ticks.length > 0) {
        loadedTicks = ticks;
      } else if (trade.entryPrice != null && trade.exitPrice != null) {
        loadedTicks = generateSyntheticTicks(
          trade.entryPrice,
          trade.exitPrice,
          new Date(trade.entryTime),
          new Date(trade.exitTime)
        );
      }
      setAllTicks(loadedTicks);

      // Generar velas históricas antes del trade
      const history = generateHistoryCandles(
        trade.entryPrice,
        new Date(trade.entryTime),
        75, // 75 velas de historia
        timeframe
      );
      setHistoryCandles(history);
      setDisplayedCandles(history);

      setCurrentTickIndex(0);
      setProgress(0);
      setIsPlaying(false);
      setCurrentTick(null);
    } catch (error) {
      console.error("Error loading ticks:", error);
      setAllTicks([]);
    }
  }, [trade, ticks, timeframe]);

  // ==================== ACTUALIZAR CHART ====================

  useEffect(() => {
    if (!candleSeriesRef.current || displayedCandles.length === 0) return;

    candleSeriesRef.current.setData(displayedCandles as CandlestickData<Time>[]);

    // Ajustar vista visible
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [displayedCandles]);

  // ==================== PRICE LINES (TP, SL, ENTRY, LEVELS) ====================

  useEffect(() => {
    if (!candleSeriesRef.current || !trade) return;

    // Limpiar price lines existentes
    // lightweight-charts no tiene un método clearPriceLines, necesitamos recrear la serie
    // En su lugar, creamos el chart con las líneas

    const series = candleSeriesRef.current;
    const isBuy = trade.signalSide === "BUY";

    // Entry line
    series.createPriceLine({
      price: trade.entryPrice,
      color: colors.entryLine,
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: "Entry",
    });

    // Take Profit line
    const tpPrice = isBuy
      ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
      : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
    series.createPriceLine({
      price: tpPrice,
      color: colors.tpLine,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "TP",
    });

    // Stop Loss line (50 pips)
    const slPrice = isBuy
      ? trade.entryPrice - 50 * PIP_VALUE
      : trade.entryPrice + 50 * PIP_VALUE;
    series.createPriceLine({
      price: slPrice,
      color: colors.slLine,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "SL",
    });

    // Grid levels
    if (trade.levels) {
      trade.levels.forEach((level) => {
        if (level.level > 0) {
          const levelColor = colors.levelColors[(level.level - 1) % colors.levelColors.length];
          series.createPriceLine({
            price: level.openPrice,
            color: levelColor,
            lineWidth: 1,
            lineStyle: 3, // Dotted
            axisLabelVisible: false,
            title: `L${level.level}`,
          });
        }
      });
    }

    // Cleanup no es straightforward en lightweight-charts
    // Las líneas persisten hasta que se destruye el chart
  }, [trade, config, colors]);

  // ==================== REPRODUCCIÓN ANIMADA ====================

  useEffect(() => {
    if (!isPlaying || allTicks.length === 0) return;

    const intervalMs = Math.max(5, 100 / speed);
    let idx = currentTickIndex;
    let currentCandles = [...historyCandles];

    const interval = setInterval(() => {
      if (idx >= allTicks.length) {
        setIsPlaying(false);
        clearInterval(interval);
        return;
      }

      const tick = allTicks[idx];
      const price = getMidPrice(tick);
      const candleStart = getCandleStartTime(new Date(tick.timestamp), timeframe);
      const timeKey = Math.floor(candleStart.getTime() / 1000);

      // Actualizar o crear vela
      const lastCandle = currentCandles[currentCandles.length - 1];
      if (lastCandle && (lastCandle.time as number) === timeKey) {
        // Actualizar vela existente
        lastCandle.high = Math.max(lastCandle.high, price);
        lastCandle.low = Math.min(lastCandle.low, price);
        lastCandle.close = price;
      } else {
        // Crear nueva vela
        currentCandles.push({
          time: timeKey as Time,
          open: price,
          high: price,
          low: price,
          close: price,
        });
      }

      setDisplayedCandles([...currentCandles]);
      setCurrentTick(tick);
      setProgress(((idx + 1) / allTicks.length) * 100);
      setCurrentTickIndex(idx);
      idx++;
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speed, allTicks, currentTickIndex, timeframe, historyCandles]);

  // ==================== CONTROLES ====================

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTickIndex(0);
    setProgress(0);
    setCurrentTick(null);
    setDisplayedCandles(historyCandles);
  }, [historyCandles]);

  const handleTimeframeChange = useCallback((tf: Timeframe) => {
    setTimeframe(tf);
    // Recalcular velas con nuevo timeframe
    if (trade && allTicks.length > 0) {
      const history = generateHistoryCandles(
        trade.entryPrice,
        new Date(trade.entryTime),
        75,
        tf
      );
      setHistoryCandles(history);
      setDisplayedCandles(history);
      setCurrentTickIndex(0);
      setProgress(0);
      setIsPlaying(false);
      setCurrentTick(null);
    }
  }, [trade, allTicks]);

  // ==================== RENDER ====================

  if (!isValidTrade(trade)) {
    return (
      <div className="text-center py-12 text-gray-400">
        {!trade ? "Selecciona un trade para ver el gráfico" : "Datos del trade incompletos"}
      </div>
    );
  }

  const isBuy = trade.signalSide === "BUY";
  const tpPrice = isBuy
    ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
    : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
  const slPrice = isBuy
    ? trade.entryPrice - 50 * PIP_VALUE
    : trade.entryPrice + 50 * PIP_VALUE;

  return (
    <div className="space-y-4">
      {/* Header con info del trade */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-800 rounded-lg">
        <div className="flex items-center gap-4">
          <span
            className={`px-3 py-1 rounded font-bold text-sm ${
              isBuy ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {trade.signalSide}
          </span>
          <div className="text-sm">
            <span className="text-gray-400">Entry: </span>
            <span className="font-mono text-white">{trade.entryPrice.toFixed(2)}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">Exit: </span>
            <span className="font-mono text-white">{trade.exitPrice.toFixed(2)}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">P/L: </span>
            <span
              className={`font-bold ${
                trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {trade.totalProfit >= 0 ? "+" : ""}
              {trade.totalProfit.toFixed(2)}€
            </span>
          </div>
        </div>
        <div
          className={`text-xs px-2 py-1 rounded ${
            trade.exitReason === "TAKE_PROFIT"
              ? "bg-green-900/50 text-green-400"
              : trade.exitReason === "TRAILING_SL"
              ? "bg-yellow-900/50 text-yellow-400"
              : "bg-red-900/50 text-red-400"
          }`}
        >
          {trade.exitReason === "TAKE_PROFIT"
            ? "TP Hit"
            : trade.exitReason === "TRAILING_SL"
            ? "Trailing SL"
            : "Stop Loss"}
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-800 rounded-lg">
        {/* Timeframe buttons */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-2">TF:</span>
          {(["1", "5", "15"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                timeframe === tf
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              M{tf}
            </button>
          ))}
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Speed:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0 text-white"
          >
            {speedOptions.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-4 py-1.5 rounded font-medium text-white flex items-center gap-2 ${
            isPlaying ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Pausar
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Play
            </>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-medium text-white flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>

        {/* Current price */}
        {currentTick && (
          <div className="ml-auto text-sm">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono text-yellow-400">
              {getMidPrice(currentTick).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{allTicks.length.toLocaleString()} ticks</span>
          <span>{currentTickIndex.toLocaleString()} procesados</span>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{
          backgroundColor: colors.background,
          height: typeof window !== "undefined" && window.innerWidth < 640 ? "350px" : "500px",
          minHeight: "350px",
        }}
      />

      {/* Price levels legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-800 rounded-lg text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: colors.entryLine }} />
          <span className="text-gray-400">Entry:</span>
          <span className="font-mono text-white">{trade.entryPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: colors.tpLine }} />
          <span className="text-gray-400">TP:</span>
          <span className="font-mono text-green-400">{tpPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: colors.slLine }} />
          <span className="text-gray-400">SL:</span>
          <span className="font-mono text-red-400">{slPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Pips:</span>
          <span
            className={`font-mono font-bold ${
              trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {isBuy
              ? ((trade.exitPrice - trade.entryPrice) / PIP_VALUE).toFixed(1)
              : ((trade.entryPrice - trade.exitPrice) / PIP_VALUE).toFixed(1)}
          </span>
        </div>
      </div>

      {/* Grid levels status */}
      {trade.levels && trade.levels.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
            Niveles de Grid
          </div>
          <LevelsStatus
            levels={trade.levels}
            currentTick={currentTick}
            isBuy={isBuy}
            pipValue={PIP_VALUE}
            levelColors={colors.levelColors}
          />
        </div>
      )}

      {!hasRealTicks && ticks.length === 0 && (
        <p className="text-yellow-400 text-sm text-center py-2">
          Sin ticks reales - simulando con ticks sintéticos
        </p>
      )}
    </div>
  );
}
