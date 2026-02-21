"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import type { IChartApi, Time } from "lightweight-charts";
import { Candle, Timeframe, ticksToCandles, candlesIterator, generateSyntheticCandles } from "@/lib/ticks-to-candles";

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

interface BacktestChartProps {
  ticks: Array<{ timestamp: Date; bid: number; ask: number; spread: number }>;
  trade: TradeDetail | null;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
  hasRealTicks?: boolean;
}

const PIP_VALUE = 0.10;

export default function BacktestChart({ ticks, trade, config, hasRealTicks = true }: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);

  const [timeframe, setTimeframe] = useState<Timeframe>("5");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [progress, setProgress] = useState(0);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentCandleIndex, setCurrentCandleIndex] = useState(0);

  const speedOptions = [1, 2, 5, 10, 20, 50, 100];

  // Limpiar líneas de precio
  const clearPriceLines = useCallback(() => {
    if (candleSeriesRef.current) {
      priceLinesRef.current.forEach(line => {
        try {
          candleSeriesRef.current?.removePriceLine(line);
        } catch (e) {
          // Ignorar
        }
      });
      priceLinesRef.current = [];
    }
  }, []);

  // Añadir líneas de precio
  const addPriceLines = useCallback(() => {
    if (!candleSeriesRef.current || !trade) return;

    clearPriceLines();

    const isBuy = trade.signalSide === "BUY";

    // Take Profit
    const tpPrice = isBuy
      ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
      : trade.entryPrice - config.takeProfitPips * PIP_VALUE;

    try {
      const tpLine = candleSeriesRef.current.createPriceLine({
        price: tpPrice,
        color: "#26a69a",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "TP",
      });
      priceLinesRef.current.push(tpLine);
    } catch (e) {
      // Ignorar
    }

    // Entry price
    try {
      const entryLine = candleSeriesRef.current.createPriceLine({
        price: trade.entryPrice,
        color: "#2196f3",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "Entry",
      });
      priceLinesRef.current.push(entryLine);
    } catch (e) {
      // Ignorar
    }

    // Niveles de promedio
    const levelColors = ["#9c27b0", "#ff9800", "#4caf50", "#e91e63"];
    trade.levels?.forEach((level, index) => {
      if (level.openPrice !== trade.entryPrice) {
        try {
          const levelLine = candleSeriesRef.current?.createPriceLine({
            price: level.openPrice,
            color: levelColors[index % levelColors.length],
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `L${level.level}`,
          });
          if (levelLine) priceLinesRef.current.push(levelLine);
        } catch (e) {
          // Ignorar
        }
      }
    });
  }, [trade, config, clearPriceLines]);

  // Inicializar gráfico
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 450,
      layout: {
        background: { type: ColorType.Solid, color: "#1e1e2e" },
        textColor: "#cdd6f4",
      },
      grid: {
        vertLines: { color: "#313244" },
        horzLines: { color: "#313244" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#89b4fa",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#89b4fa",
        },
        horzLine: {
          color: "#89b4fa",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#89b4fa",
        },
      },
      rightPriceScale: {
        borderColor: "#313244",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#313244",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // API de lightweight-charts v5
    const candleSeries = (chart as any).addSeries({
      type: 'Candlestick',
    }, {
      upColor: "#a6e3a1",
      downColor: "#f38ba8",
      borderUpColor: "#a6e3a1",
      borderDownColor: "#f38ba8",
      wickUpColor: "#a6e3a1",
      wickDownColor: "#f38ba8",
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

  // Cargar velas cuando cambia trade o timeframe
  useEffect(() => {
    if (!candleSeriesRef.current || !trade) return;

    clearPriceLines();
    setIsPlaying(false);
    setProgress(0);
    setCurrentCandleIndex(0);

    let candles: Candle[] = [];

    if (ticks.length > 0) {
      candles = ticksToCandles(ticks, timeframe);
    } else {
      // Generar velas sintéticas si no hay ticks reales
      candles = generateSyntheticCandles(
        trade.entryPrice,
        trade.exitPrice,
        new Date(trade.entryTime),
        new Date(trade.exitTime),
        timeframe
      );
    }

    if (candles.length > 0) {
      candleSeriesRef.current.setData(candles);

      // Añadir marcadores
      const isBuy = trade.signalSide === "BUY";
      const markers = [
        {
          time: candles[0].time as Time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: isBuy ? "#a6e3a1" : "#f38ba8",
          shape: isBuy ? "arrowUp" : "arrowDown",
          text: `${trade.signalSide} @ ${trade.entryPrice.toFixed(2)}`,
        },
        {
          time: candles[candles.length - 1].time as Time,
          position: trade.exitReason === "TAKE_PROFIT" ? "aboveBar" : "belowBar",
          color: trade.exitReason === "TAKE_PROFIT" ? "#a6e3a1" :
                 trade.exitReason === "TRAILING_SL" ? "#f9e2af" : "#f38ba8",
          shape: "circle",
          text: `${trade.exitReason}`,
        },
      ];

      try {
        candleSeriesRef.current.setMarkers(markers);
      } catch (e) {
        console.warn("Error setting markers:", e);
      }

      addPriceLines();
      chartRef.current?.timeScale().fitContent();
    }
  }, [trade, timeframe, ticks, clearPriceLines, addPriceLines]);

  // Reproducción animada
  useEffect(() => {
    if (!isPlaying || !candleSeriesRef.current || !trade) return;

    const ticksToUse = ticks.length > 0 ? ticks : [];
    if (ticksToUse.length === 0) {
      setIsPlaying(false);
      return;
    }

    const iterator = candlesIterator(ticksToUse, timeframe);
    const intervalMs = Math.max(10, 100 / speed);

    // Saltar al índice actual si es que se pausó
    for (let i = 0; i < currentCandleIndex; i++) {
      iterator.next();
    }

    const interval = setInterval(() => {
      const result = iterator.next();

      if (result.done) {
        setIsPlaying(false);
        clearInterval(interval);
        return;
      }

      const { candle, tickIndex, totalTicks } = result.value;

      // Actualizar vela en el gráfico
      try {
        candleSeriesRef.current?.update(candle);
      } catch (e) {
        // Ignorar errores de actualización
      }

      setCurrentPrice(candle.close);
      setProgress((tickIndex / totalTicks) * 100);
      setCurrentCandleIndex(tickIndex);

    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speed, ticks, timeframe, trade, currentCandleIndex]);

  // Reset
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentCandleIndex(0);
    setCurrentPrice(null);

    if (candleSeriesRef.current && trade) {
      let candles: Candle[] = [];
      if (ticks.length > 0) {
        candles = ticksToCandles(ticks, timeframe);
      } else {
        candles = generateSyntheticCandles(
          trade.entryPrice,
          trade.exitPrice,
          new Date(trade.entryTime),
          new Date(trade.exitTime),
          timeframe
        );
      }
      candleSeriesRef.current.setData(candles);
      addPriceLines();
      chartRef.current?.timeScale().fitContent();
    }
  }, [trade, ticks, timeframe, addPriceLines]);

  if (!trade) {
    return (
      <div className="text-center py-12 text-gray-400">
        Selecciona un trade para ver el gráfico
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800 rounded-lg">
        {/* Timeframe */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">TF:</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0"
          >
            <option value="1">M1</option>
            <option value="5">M5</option>
            <option value="15">M15</option>
            <option value="60">H1</option>
          </select>
        </div>

        {/* Velocidad */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Speed:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0"
          >
            {speedOptions.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={ticks.length === 0}
          className={`px-4 py-1.5 rounded font-medium ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-green-600 hover:bg-green-700"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isPlaying ? "⏸ Pausar" : "▶ Play"}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-medium"
        >
          ⟲ Reset
        </button>

        {/* Info precio actual */}
        {currentPrice && (
          <div className="ml-auto text-sm">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono text-white">{currentPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Gráfico */}
      <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />

      {/* Info del trade */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-800 rounded-lg text-sm">
        <div>
          <span className="text-gray-400 text-xs">Side</span>
          <div className={`font-bold ${trade.signalSide === "BUY" ? "text-green-400" : "text-red-400"}`}>
            {trade.signalSide}
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Entrada</span>
          <div className="font-mono">{trade.entryPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Salida</span>
          <div className="font-mono">{trade.exitPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Profit</span>
          <div className={`font-bold ${trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit.toFixed(2)}€
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Cierre</span>
          <div className={`${
            trade.exitReason === "TAKE_PROFIT" ? "text-green-400" :
            trade.exitReason === "TRAILING_SL" ? "text-yellow-400" : "text-red-400"
          }`}>
            {trade.exitReason === "TAKE_PROFIT" ? "TP" :
             trade.exitReason === "TRAILING_SL" ? "Trail" : "SL"}
          </div>
        </div>
      </div>

      {/* Mensaje si no hay ticks reales */}
      {!hasRealTicks && ticks.length === 0 && (
        <p className="text-yellow-400 text-sm text-center py-2">
          ⚠️ Sin ticks reales - mostrando velas sintéticas
        </p>
      )}
    </div>
  );
}
