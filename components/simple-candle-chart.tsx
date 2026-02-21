"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type Timeframe = "1" | "5" | "15" | "60";

const PIP_VALUE = 0.10;
const COLORS = {
  background: "#1e1e2e",
  grid: "#313244",
  text: "#cdd6f4",
  candleUp: "#a6e3a1",
  candleDown: "#f38ba8",
  entryLine: "#2196f3",
  tpLine: "#26a69a",
  slLine: "#f38ba8",
  levelColors: ["#9c27b0", "#ff9800", "#4caf50", "#e91e63"],
};

export default function SimpleCandleChart({
  ticks,
  trade,
  config,
  hasRealTicks = true,
}: {
  ticks: Tick[];
  trade: TradeDetail | null;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
  hasRealTicks?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("5");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [progress, setProgress] = useState(0);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [visibleCandles, setVisibleCandles] = useState<Candle[]>([]);
  const [playIndex, setPlayIndex] = useState(0);

  const speedOptions = [1, 2, 5, 10, 20, 50, 100];

  // Convertir ticks a velas
  const ticksToCandles = useCallback((tickData: Tick[], tf: Timeframe): Candle[] => {
    if (tickData.length === 0) return [];

    const intervalMs = parseInt(tf) * 60 * 1000;
    const result: Candle[] = [];
    let current: Partial<Candle> | null = null;

    for (const tick of tickData) {
      const timestamp = new Date(tick.timestamp).getTime();
      const candleTime = Math.floor(timestamp / intervalMs) * intervalMs;
      const price = (tick.bid + tick.ask) / 2;

      if (!current || current.time !== Math.floor(candleTime / 1000)) {
        if (current && current.time !== undefined) {
          result.push(current as Candle);
        }
        current = {
          time: Math.floor(candleTime / 1000),
          open: price,
          high: price,
          low: price,
          close: price,
        };
      } else {
        current.high = Math.max(current.high!, price);
        current.low = Math.min(current.low!, price);
        current.close = price;
      }
    }

    if (current && current.time !== undefined) {
      result.push(current as Candle);
    }

    return result;
  }, []);

  // Generar velas sintéticas
  const generateSyntheticCandles = useCallback((
    entryPrice: number,
    exitPrice: number,
    entryTime: Date,
    exitTime: Date,
    tf: Timeframe
  ): Candle[] => {
    const intervalMs = parseInt(tf) * 60 * 1000;
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const numCandles = Math.max(3, Math.ceil(durationMs / intervalMs));
    const result: Candle[] = [];
    const priceDiff = exitPrice - entryPrice;
    const variation = Math.abs(priceDiff) * 0.15;

    for (let i = 0; i < numCandles; i++) {
      const progress = i / Math.max(1, numCandles - 1);
      const basePrice = entryPrice + priceDiff * progress;
      const noise = () => (Math.random() - 0.5) * variation;

      const open = basePrice + noise();
      const close = basePrice + noise();
      const high = Math.max(open, close) + Math.random() * variation * 0.5;
      const low = Math.min(open, close) - Math.random() * variation * 0.5;

      result.push({
        time: Math.floor((entryTime.getTime() + i * intervalMs) / 1000),
        open,
        high,
        low,
        close,
      });
    }

    return result;
  }, []);

  // Cargar velas cuando cambia trade o timeframe
  useEffect(() => {
    if (!trade) {
      setCandles([]);
      setVisibleCandles([]);
      return;
    }

    let newCandles: Candle[] = [];

    if (ticks.length > 0) {
      newCandles = ticksToCandles(ticks, timeframe);
    } else {
      newCandles = generateSyntheticCandles(
        trade.entryPrice,
        trade.exitPrice,
        new Date(trade.entryTime),
        new Date(trade.exitTime),
        timeframe
      );
    }

    setCandles(newCandles);
    setVisibleCandles(newCandles);
    setPlayIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setCurrentPrice(null);
  }, [trade, timeframe, ticks, ticksToCandles, generateSyntheticCandles]);

  // Reproducción animada
  useEffect(() => {
    if (!isPlaying || candles.length === 0) return;

    const intervalMs = Math.max(50, 300 / speed);
    let idx = playIndex;

    const interval = setInterval(() => {
      if (idx >= candles.length) {
        setIsPlaying(false);
        clearInterval(interval);
        return;
      }

      setVisibleCandles(candles.slice(0, idx + 1));
      setCurrentPrice(candles[idx].close);
      setProgress(((idx + 1) / candles.length) * 100);
      setPlayIndex(idx);
      idx++;
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speed, candles, playIndex]);

  // Dibujar gráfico
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || visibleCandles.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurar tamaño del canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 400 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = "400px";
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 400;
    const padding = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Limpiar
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Calcular rango de precios
    let minPrice = Math.min(...visibleCandles.map((c) => c.low));
    let maxPrice = Math.max(...visibleCandles.map((c) => c.high));

    // Añadir margen
    const priceRange = maxPrice - minPrice;
    minPrice -= priceRange * 0.1;
    maxPrice += priceRange * 0.1;

    const priceToY = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;

    // Dibujar grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;

    // Líneas horizontales (precios)
    const priceStep = (maxPrice - minPrice) / 5;
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + priceStep * i;
      const y = priceToY(price);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Etiqueta de precio
      ctx.fillStyle = COLORS.text;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 4);
    }

    // Líneas verticales (tiempo)
    const candleWidth = chartWidth / Math.max(visibleCandles.length, 1);
    const timeStep = Math.max(1, Math.floor(visibleCandles.length / 6));

    for (let i = 0; i < visibleCandles.length; i += timeStep) {
      const x = padding.left + i * candleWidth + candleWidth / 2;

      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Dibujar líneas de precio del trade
    if (trade) {
      const isBuy = trade.signalSide === "BUY";

      // Entry line
      const entryY = priceToY(trade.entryPrice);
      ctx.strokeStyle = COLORS.entryLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.entryLine;
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(`Entry: ${trade.entryPrice.toFixed(2)}`, padding.left + 5, entryY - 5);

      // TP line
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      const tpY = priceToY(tpPrice);
      ctx.strokeStyle = COLORS.tpLine;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.tpLine;
      ctx.fillText(`TP: ${tpPrice.toFixed(2)}`, padding.left + 5, tpY - 5);

      // Level lines
      trade.levels?.forEach((level, index) => {
        if (level.openPrice !== trade.entryPrice) {
          const levelY = priceToY(level.openPrice);
          ctx.strokeStyle = COLORS.levelColors[index % COLORS.levelColors.length];
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(padding.left, levelY);
          ctx.lineTo(width - padding.right, levelY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = COLORS.levelColors[index % COLORS.levelColors.length];
          ctx.fillText(`L${level.level}: ${level.openPrice.toFixed(2)}`, padding.left + 5, levelY + 12);
        }
      });
    }

    // Dibujar velas
    const barWidth = Math.min(candleWidth * 0.7, 20);
    const bodyWidth = barWidth * 0.7;

    visibleCandles.forEach((candle, i) => {
      const x = padding.left + i * candleWidth + candleWidth / 2;
      const isUp = candle.close >= candle.open;

      // Mecha
      ctx.strokeStyle = isUp ? COLORS.candleUp : COLORS.candleDown;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(candle.high));
      ctx.lineTo(x, priceToY(candle.low));
      ctx.stroke();

      // Cuerpo
      const bodyTop = priceToY(Math.max(candle.open, candle.close));
      const bodyBottom = priceToY(Math.min(candle.open, candle.close));
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      ctx.fillStyle = isUp ? COLORS.candleUp : COLORS.candleDown;
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });

    // Dibujar flecha de entrada
    if (trade && visibleCandles.length > 0) {
      const isBuy = trade.signalSide === "BUY";
      const firstCandleIdx = 0;
      const x = padding.left + firstCandleIdx * candleWidth + candleWidth / 2;
      const y = priceToY(trade.entryPrice);

      ctx.fillStyle = isBuy ? COLORS.candleUp : COLORS.candleDown;
      ctx.beginPath();

      if (isBuy) {
        // Flecha hacia arriba
        ctx.moveTo(x, y + 15);
        ctx.lineTo(x - 8, y + 25);
        ctx.lineTo(x + 8, y + 25);
        ctx.closePath();
      } else {
        // Flecha hacia abajo
        ctx.moveTo(x, y - 15);
        ctx.lineTo(x - 8, y - 25);
        ctx.lineTo(x + 8, y - 25);
        ctx.closePath();
      }
      ctx.fill();

      // Etiqueta
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(trade.signalSide, x + 12, isBuy ? y + 22 : y - 18);
    }

    // Dibujar marcador de salida
    if (trade && visibleCandles.length > 0) {
      const lastCandleIdx = visibleCandles.length - 1;
      const x = padding.left + lastCandleIdx * candleWidth + candleWidth / 2;
      const y = priceToY(trade.exitPrice);

      ctx.fillStyle =
        trade.exitReason === "TAKE_PROFIT"
          ? COLORS.candleUp
          : trade.exitReason === "TRAILING_SL"
          ? "#f9e2af"
          : COLORS.candleDown;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "bold 9px sans-serif";
      const label =
        trade.exitReason === "TAKE_PROFIT"
          ? "TP"
          : trade.exitReason === "TRAILING_SL"
          ? "Trail"
          : "SL";
      ctx.fillText(label, x + 10, y + 4);
    }
  }, [visibleCandles, trade, config]);

  // Reset
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setPlayIndex(0);
    setProgress(0);
    setCurrentPrice(null);
    setVisibleCandles(candles);
  }, [candles]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      // Forzar re-render del canvas
      setVisibleCandles([...visibleCandles]);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [visibleCandles]);

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
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0 text-white"
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
          className={`px-4 py-1.5 rounded font-medium text-white ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPlaying ? "⏸ Pausar" : "▶ Play"}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-medium text-white"
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

      {/* Gráfico Canvas */}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden bg-slate-900">
        <canvas ref={canvasRef} />
      </div>

      {/* Info del trade */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-800 rounded-lg text-sm">
        <div>
          <span className="text-gray-400 text-xs">Side</span>
          <div
            className={`font-bold ${
              trade.signalSide === "BUY" ? "text-green-400" : "text-red-400"
            }`}
          >
            {trade.signalSide}
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Entrada</span>
          <div className="font-mono text-white">{trade.entryPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Salida</span>
          <div className="font-mono text-white">{trade.exitPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Profit</span>
          <div
            className={`font-bold ${
              trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {trade.totalProfit >= 0 ? "+" : ""}
            {trade.totalProfit.toFixed(2)}€
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Cierre</span>
          <div
            className={`${
              trade.exitReason === "TAKE_PROFIT"
                ? "text-green-400"
                : trade.exitReason === "TRAILING_SL"
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {trade.exitReason === "TAKE_PROFIT"
              ? "TP"
              : trade.exitReason === "TRAILING_SL"
              ? "Trail"
              : "SL"}
          </div>
        </div>
      </div>

      {/* Mensaje si no hay ticks reales */}
      {!hasRealTicks && ticks.length === 0 && (
        <p className="text-yellow-400 text-sm text-center py-2">
          Sin ticks reales - mostrando velas sintéticas
        </p>
      )}
    </div>
  );
}
