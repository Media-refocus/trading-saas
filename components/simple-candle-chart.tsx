"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getThemeColors } from "@/lib/chart-themes";

// ==================== TYPES ====================

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
  spread?: number;
}

interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type Timeframe = "1" | "5" | "15";

interface SimpleCandleChartProps {
  ticks: Tick[];
  trade: TradeDetail | null;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
  hasRealTicks?: boolean;
  themeId?: string;
}

// ==================== CONSTANTS ====================

const PIP_VALUE = 0.1;
const HISTORY_CANDLES = 50;
const SPEED_INTERVALS: Record<number, number> = {
  1: 500,
  2: 250,
  5: 100,
  10: 50,
};
const DEFAULT_SPEED = 1;
const CANDLE_BODY_RATIO = 0.65;
const MIN_CANDLES_VISIBLE = 20;
const MAX_CANDLES_VISIBLE = 200;

// ==================== UTILITY FUNCTIONS ====================

function getTimeframeMs(tf: Timeframe): number {
  return parseInt(tf) * 60 * 1000;
}

function getCandleTime(timestamp: Date, tf: Timeframe): number {
  const intervalMs = getTimeframeMs(tf);
  const time = timestamp.getTime();
  return Math.floor(time / intervalMs) * intervalMs;
}

function getMidPrice(tick: Tick): number {
  return (tick.bid + tick.ask) / 2;
}

function generateHistoryCandles(
  entryPrice: number,
  entryTime: Date,
  count: number,
  tf: Timeframe
): OHLC[] {
  const candles: OHLC[] = [];
  const intervalMs = getTimeframeMs(tf);
  let currentPrice = entryPrice;
  let currentTime = getCandleTime(entryTime, tf) - intervalMs;

  for (let i = 0; i < count; i++) {
    // XAUUSD realistic volatility: 0.5-2 pips per candle
    const volatility = 0.05 + Math.random() * 0.15;
    const trend = (Math.random() - 0.5) * 0.03;
    const open = currentPrice;
    const close = open + trend + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.unshift({
      time: Math.floor(currentTime / 1000),
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

function aggregateTicksToCandles(ticks: Tick[], tf: Timeframe): OHLC[] {
  if (ticks.length === 0) return [];

  const candleMap = new Map<number, OHLC>();

  for (const tick of ticks) {
    const price = getMidPrice(tick);
    const candleTime = getCandleTime(new Date(tick.timestamp), tf);
    const timeKey = Math.floor(candleTime / 1000);

    const existing = candleMap.get(timeKey);
    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    } else {
      candleMap.set(timeKey, {
        time: timeKey,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    }
  }

  return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
}

function generateSyntheticTicks(
  entryPrice: number,
  exitPrice: number,
  entryTime: Date,
  exitTime: Date
): Tick[] {
  const entryMs = entryTime.getTime();
  const exitMs = exitTime.getTime();
  const durationMs = exitMs - entryMs;

  if (durationMs <= 0) return [];

  const avgInterval = 300;
  const numTicks = Math.max(100, Math.ceil(durationMs / avgInterval));
  const ticks: Tick[] = [];
  const priceDiff = exitPrice - entryPrice;
  const baseSpread = 0.02;

  let currentPrice = entryPrice;
  let lastTime = entryMs;

  for (let i = 0; i < numTicks; i++) {
    const progress = numTicks > 1 ? i / (numTicks - 1) : 0;
    const targetPrice = entryPrice + priceDiff * progress;
    const trend = (targetPrice - currentPrice) * 0.1;
    const noise = (Math.random() - 0.5) * 0.05;
    currentPrice += trend + noise;

    const spread = baseSpread + (Math.random() - 0.5) * 0.01;
    lastTime += avgInterval + (Math.random() - 0.5) * 200;

    ticks.push({
      timestamp: new Date(lastTime),
      bid: currentPrice,
      ask: currentPrice + spread,
      spread,
    });
  }

  return ticks;
}

// ==================== LEVELS STATUS COMPONENT ====================

function LevelsStatus({
  levels,
  currentTick,
  isBuy,
  levelColors,
}: {
  levels: TradeLevel[];
  currentTick: Tick | null;
  isBuy: boolean;
  levelColors: string[];
}) {
  const currentTimeMs = currentTick
    ? new Date(currentTick.timestamp).getTime()
    : Date.now();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {levels.map((level) => {
        const entryTimeMs = levels[0]?.openTime
          ? new Date(levels[0].openTime).getTime()
          : 0;
        const openTimeMs = level.openTime
          ? new Date(level.openTime).getTime()
          : level.level === 0
            ? entryTimeMs
            : Infinity;
        const closeTimeMs = level.closeTime
          ? new Date(level.closeTime).getTime()
          : Infinity;

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
            ? (level.closePrice - level.openPrice) / PIP_VALUE
            : (level.openPrice - level.closePrice) / PIP_VALUE;
        }

        return (
          <div
            key={level.level}
            className={`p-2 rounded text-[11px] sm:text-xs border ${
              isPending
                ? "border-gray-700 bg-gray-800/50 opacity-50"
                : isClosed
                  ? "border-gray-600 bg-gray-800"
                  : "border-current"
            }`}
            style={{
              borderColor: isClosed || isPending ? undefined : levelColor,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold" style={{ color: levelColor }}>
                {level.level === 0 ? "ENTRY" : `L${level.level}`}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] ${
                  isPending
                    ? "bg-gray-700 text-gray-400"
                    : isClosed
                      ? "bg-green-900/50 text-green-400"
                      : "bg-blue-900/50 text-blue-400 animate-pulse"
                }`}
              >
                {isPending ? "PEND" : isClosed ? "OK" : "ACT"}
              </span>
            </div>
            <div className="font-mono text-gray-300">
              {level.openPrice.toFixed(2)}
            </div>
            {isClosed && (
              <div className="text-green-400 font-mono mt-1 text-[10px] sm:text-xs">
                +{pipsGained.toFixed(1)} pips
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function SimpleCandleChart({
  ticks,
  trade,
  config,
  hasRealTicks = true,
  themeId = "mt5",
}: SimpleCandleChartProps) {
  const colors = getThemeColors(themeId);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Chart state
  const [timeframe, setTimeframe] = useState<Timeframe>("1");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [progress, setProgress] = useState(0);
  const [currentTickIndex, setCurrentTickIndex] = useState(0);
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);

  // View state
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartVisibleStart, setDragStartVisibleStart] = useState(0);

  // Touch zoom state
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);

  // Crosshair state
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  const [isMobile, setIsMobile] = useState(false);

  // Derived data
  const [allTicks, setAllTicks] = useState<Tick[]>([]);
  const [historyCandles, setHistoryCandles] = useState<OHLC[]>([]);
  const [tradeCandles, setTradeCandles] = useState<OHLC[]>([]);
  const [displayedCandles, setDisplayedCandles] = useState<OHLC[]>([]);

  // Price range for visible candles
  const priceRange = useMemo(() => {
    const visible = displayedCandles.slice(visibleStart, visibleStart + visibleCount);
    if (visible.length === 0) return { min: 0, max: 1 };

    let min = Infinity;
    let max = -Infinity;
    for (const c of visible) {
      min = Math.min(min, c.low);
      max = Math.max(max, c.high);
    }

    // Include trade markers in range
    if (trade) {
      const isBuy = trade.signalSide === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      const slPrice = isBuy
        ? trade.entryPrice - 50 * PIP_VALUE
        : trade.entryPrice + 50 * PIP_VALUE;

      min = Math.min(min, trade.entryPrice, tpPrice, slPrice);
      max = Math.max(max, trade.entryPrice, tpPrice, slPrice);

      if (trade.levels) {
        for (const level of trade.levels) {
          min = Math.min(min, level.openPrice);
          max = Math.max(max, level.openPrice);
        }
      }
    }

    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  }, [displayedCandles, visibleStart, visibleCount, trade, config]);

  // ==================== RESPONSIVE HANDLING ====================

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mobile = rect.width < 768;
        setIsMobile(mobile);
        setDimensions({
          width: rect.width,
          height: mobile ? 300 : 450,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // ==================== LOAD TICKS ====================

  useEffect(() => {
    if (!trade) {
      setAllTicks([]);
      setHistoryCandles([]);
      setTradeCandles([]);
      setDisplayedCandles([]);
      setCurrentTickIndex(0);
      setProgress(0);
      setIsPlaying(false);
      setCurrentTick(null);
      return;
    }

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

    const history = generateHistoryCandles(
      trade.entryPrice,
      new Date(trade.entryTime),
      HISTORY_CANDLES,
      timeframe
    );
    setHistoryCandles(history);

    const tradeCndl = aggregateTicksToCandles(loadedTicks, timeframe);
    setTradeCandles(tradeCndl);

    setDisplayedCandles(history);
    setCurrentTickIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setCurrentTick(null);
    setVisibleStart(0);
    setVisibleCount(60);
  }, [trade, ticks, timeframe]);

  // ==================== REPLAY ANIMATION ====================

  useEffect(() => {
    if (!isPlaying || allTicks.length === 0) {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
      return;
    }

    const intervalMs = SPEED_INTERVALS[speed] || 500;
    let idx = currentTickIndex;
    let currentCandles = [...historyCandles];

    replayIntervalRef.current = setInterval(() => {
      if (idx >= allTicks.length) {
        setIsPlaying(false);
        if (replayIntervalRef.current) {
          clearInterval(replayIntervalRef.current);
          replayIntervalRef.current = null;
        }
        return;
      }

      const tick = allTicks[idx];
      const price = getMidPrice(tick);
      const candleTime = getCandleTime(new Date(tick.timestamp), timeframe);
      const timeKey = Math.floor(candleTime / 1000);

      const lastCandle = currentCandles[currentCandles.length - 1];
      if (lastCandle && lastCandle.time === timeKey) {
        lastCandle.high = Math.max(lastCandle.high, price);
        lastCandle.low = Math.min(lastCandle.low, price);
        lastCandle.close = price;
      } else {
        currentCandles.push({
          time: timeKey,
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

    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
    };
  }, [isPlaying, speed, allTicks, currentTickIndex, timeframe, historyCandles]);

  // ==================== CANVAS RENDERING ====================

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;

    // Set canvas size with DPR
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Chart area
    const padding = { top: 20, right: 70, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Get visible candles
    const visible = displayedCandles.slice(visibleStart, visibleStart + visibleCount);
    if (visible.length === 0) {
      ctx.fillStyle = colors.text;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay datos", width / 2, height / 2);
      return;
    }

    const { min: minPrice, max: maxPrice } = priceRange;
    const priceRangeValue = maxPrice - minPrice || 1;

    // Helper functions
    const priceToY = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / priceRangeValue) * chartHeight;

    const indexToX = (index: number) => {
      const candleWidth = chartWidth / visibleCount;
      return padding.left + index * candleWidth + candleWidth / 2;
    };

    // Draw grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    // Horizontal grid (price)
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (priceRangeValue * i) / priceSteps;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Price labels
      ctx.fillStyle = colors.text;
      ctx.font = `${isMobile ? 10 : 11}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 4);
    }

    // Vertical grid (time)
    const timeSteps = Math.min(6, visible.length);
    for (let i = 0; i < timeSteps; i++) {
      const idx = Math.floor((i / (timeSteps - 1)) * (visible.length - 1));
      const x = indexToX(idx);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Time labels
      if (visible[idx]) {
        const date = new Date(visible[idx].time * 1000);
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        ctx.fillStyle = colors.text;
        ctx.font = `${isMobile ? 9 : 10}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(timeStr, x, height - padding.bottom + 15);
      }
    }

    // Calculate candle dimensions
    const candleSlotWidth = chartWidth / visibleCount;
    const candleBodyWidth = candleSlotWidth * CANDLE_BODY_RATIO;
    const candleWickWidth = 1;

    // Draw candles
    for (let i = 0; i < visible.length; i++) {
      const candle = visible[i];
      const x = indexToX(i);
      const isBullish = candle.close >= candle.open;

      const color = isBullish ? colors.candleUp : colors.candleDown;
      const wickColor = isBullish ? colors.wickUp : colors.wickDown;

      const openY = priceToY(candle.open);
      const closeY = priceToY(candle.close);
      const highY = priceToY(candle.high);
      const lowY = priceToY(candle.low);

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = candleWickWidth;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY) || 1;

      ctx.fillStyle = color;
      ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight);
    }

    // Draw trade markers
    if (trade) {
      const isBuy = trade.signalSide === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      const slPrice = isBuy
        ? trade.entryPrice - 50 * PIP_VALUE
        : trade.entryPrice + 50 * PIP_VALUE;

      // Entry line
      const entryY = priceToY(trade.entryPrice);
      ctx.strokeStyle = colors.entryLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();

      ctx.fillStyle = colors.entryLine;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Entry", width - padding.right + 5, entryY + 4);

      // TP line
      const tpY = priceToY(tpPrice);
      ctx.strokeStyle = colors.tpLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();

      ctx.fillStyle = colors.tpLine;
      ctx.fillText("TP", width - padding.right + 5, tpY + 4);

      // SL line
      const slY = priceToY(slPrice);
      ctx.strokeStyle = colors.slLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, slY);
      ctx.lineTo(width - padding.right, slY);
      ctx.stroke();

      ctx.fillStyle = colors.slLine;
      ctx.fillText("SL", width - padding.right + 5, slY + 4);

      ctx.setLineDash([]);

      // Level lines
      if (trade.levels) {
        for (const level of trade.levels) {
          if (level.level > 0) {
            const levelColor = colors.levelColors[(level.level - 1) % colors.levelColors.length];
            const levelY = priceToY(level.openPrice);

            ctx.strokeStyle = levelColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, levelY);
            ctx.lineTo(width - padding.right, levelY);
            ctx.stroke();

            ctx.fillStyle = levelColor;
            ctx.font = "10px sans-serif";
            ctx.fillText(`L${level.level}`, width - padding.right + 5, levelY + 3);
          }
        }
        ctx.setLineDash([]);
      }

      // Exit marker
      if (trade.exitPrice && displayedCandles.length > 0) {
        // Find the last candle (exit)
        const lastCandle = displayedCandles[displayedCandles.length - 1];
        if (lastCandle) {
          const exitIdx = displayedCandles.length - 1 - visibleStart;
          if (exitIdx >= 0 && exitIdx < visibleCount) {
            const exitX = indexToX(exitIdx);
            const exitY = priceToY(trade.exitPrice);

            // Triangle marker
            ctx.fillStyle = trade.totalProfit >= 0 ? colors.tpLine : colors.slLine;
            ctx.beginPath();
            if (isBuy) {
              ctx.moveTo(exitX, exitY - 10);
              ctx.lineTo(exitX - 6, exitY - 2);
              ctx.lineTo(exitX + 6, exitY - 2);
            } else {
              ctx.moveTo(exitX, exitY + 10);
              ctx.lineTo(exitX - 6, exitY + 2);
              ctx.lineTo(exitX + 6, exitY + 2);
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // Draw crosshair
    if (mousePos && mousePos.x > padding.left && mousePos.x < width - padding.right) {
      ctx.strokeStyle = colors.text + "40";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mousePos.x, padding.top);
      ctx.lineTo(mousePos.x, height - padding.bottom);
      ctx.stroke();

      // Horizontal line
      if (mousePos.y > padding.top && mousePos.y < height - padding.bottom) {
        ctx.beginPath();
        ctx.moveTo(padding.left, mousePos.y);
        ctx.lineTo(width - padding.right, mousePos.y);
        ctx.stroke();

        // Price label at crosshair
        const price = minPrice + ((height - padding.bottom - mousePos.y) / chartHeight) * priceRangeValue;
        ctx.fillStyle = colors.text;
        ctx.font = "11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(price.toFixed(2), width - padding.right + 5, mousePos.y + 4);
      }

      ctx.setLineDash([]);
    }
  }, [dimensions, displayedCandles, visibleStart, visibleCount, priceRange, colors, trade, config, mousePos, isMobile]);

  // Render on state changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // ==================== MOUSE/TOUCH HANDLERS ====================

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartVisibleStart(visibleStart);
  }, [visibleStart]);

  const handleMouseMoveDrag = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = e.clientX - dragStartX;
    const candleWidth = (rect.width - 80) / visibleCount;
    const candleDelta = Math.round(deltaX / candleWidth);

    const newStart = Math.max(0, Math.min(displayedCandles.length - visibleCount, dragStartVisibleStart - candleDelta));
    setVisibleStart(newStart);
  }, [isDragging, dragStartX, dragStartVisibleStart, visibleCount, displayedCandles.length]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 5 : -5;
    const newCount = Math.max(MIN_CANDLES_VISIBLE, Math.min(MAX_CANDLES_VISIBLE, visibleCount + delta));

    // Adjust visibleStart to keep center candle in center
    const centerOffset = visibleCount / 2;
    const newCenterOffset = newCount / 2;
    const newStart = Math.max(0, Math.min(displayedCandles.length - newCount, Math.round(visibleStart + centerOffset - newCenterOffset)));

    setVisibleCount(newCount);
    setVisibleStart(newStart);
  }, [visibleCount, visibleStart, displayedCandles.length]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStartX(e.touches[0].clientX);
      setDragStartVisibleStart(visibleStart);
    } else if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setLastPinchDistance(Math.sqrt(dx * dx + dy * dy));
    }
  }, [visibleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const deltaX = e.touches[0].clientX - dragStartX;
      const candleWidth = (rect.width - 80) / visibleCount;
      const candleDelta = Math.round(deltaX / candleWidth);

      const newStart = Math.max(0, Math.min(displayedCandles.length - visibleCount, dragStartVisibleStart - candleDelta));
      setVisibleStart(newStart);
    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const delta = (lastPinchDistance - distance) / 10;
      const newCount = Math.max(MIN_CANDLES_VISIBLE, Math.min(MAX_CANDLES_VISIBLE, visibleCount + Math.round(delta)));

      setVisibleCount(newCount);
      setLastPinchDistance(distance);
    }
  }, [isDragging, dragStartX, dragStartVisibleStart, visibleCount, displayedCandles.length, lastPinchDistance]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setLastPinchDistance(null);
  }, []);

  // ==================== HANDLERS ====================

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTickIndex(0);
    setProgress(0);
    setCurrentTick(null);
    setDisplayedCandles(historyCandles);
    setVisibleStart(0);
    setVisibleCount(60);
  }, [historyCandles]);

  const handleTimeframeChange = useCallback(
    (tf: Timeframe) => {
      setTimeframe(tf);
      if (trade) {
        const history = generateHistoryCandles(
          trade.entryPrice,
          new Date(trade.entryTime),
          HISTORY_CANDLES,
          tf
        );
        setHistoryCandles(history);

        const tradeCndl = aggregateTicksToCandles(allTicks, tf);
        setTradeCandles(tradeCndl);

        setDisplayedCandles(history);
        setCurrentTickIndex(0);
        setProgress(0);
        setIsPlaying(false);
        setCurrentTick(null);
        setVisibleStart(0);
        setVisibleCount(60);
      }
    },
    [trade, allTicks]
  );

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // If at end, reset first
      if (currentTickIndex >= allTicks.length - 1) {
        setDisplayedCandles(historyCandles);
        setCurrentTickIndex(0);
        setProgress(0);
        setCurrentTick(null);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentTickIndex, allTicks.length, historyCandles]);

  // ==================== VALIDATION ====================

  if (!trade) {
    return (
      <div className="text-center py-12 text-gray-400">
        Selecciona un trade para ver el gráfico
      </div>
    );
  }

  if (
    trade.entryPrice == null ||
    isNaN(trade.entryPrice) ||
    trade.exitPrice == null ||
    isNaN(trade.exitPrice)
  ) {
    return (
      <div className="text-center py-12 text-gray-400">
        Datos del trade incompletos
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

  // ==================== RENDER ====================

  return (
    <div className="space-y-3">
      {/* Trade header */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 p-3 bg-slate-800 rounded-lg">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span
            className={`px-3 py-1.5 sm:py-1 rounded font-bold text-[13px] sm:text-sm ${
              isBuy ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {trade.signalSide}
          </span>
          <div className="text-[13px] sm:text-sm">
            <span className="text-gray-400">Entry: </span>
            <span className="font-mono text-white">
              {trade.entryPrice.toFixed(2)}
            </span>
          </div>
          <div className="text-[13px] sm:text-sm">
            <span className="text-gray-400">Exit: </span>
            <span className="font-mono text-white">
              {trade.exitPrice.toFixed(2)}
            </span>
          </div>
          <div className="text-[13px] sm:text-sm">
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
          className={`text-[11px] sm:text-xs px-2 py-1 rounded ${
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

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-800 rounded-lg">
        {/* Timeframe buttons */}
        <div className="flex items-center gap-1">
          {(["1", "5", "15"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-3 py-2 sm:py-1.5 rounded text-[13px] sm:text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
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
        <div className="flex items-center gap-1">
          {([1, 2, 5, 10] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-3 py-2 sm:py-1.5 rounded text-[13px] sm:text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 min-w-[44px] sm:min-w-0 ${
                speed === s
                  ? "bg-purple-600 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          className={`px-4 py-2 sm:py-1.5 rounded font-medium text-white flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline">Pausar</span>
              <span className="sm:hidden">||</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              Play
            </>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-4 py-2 sm:py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-medium text-white flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Current price */}
        {currentTick && (
          <div className="w-full sm:w-auto sm:ml-auto text-[13px] sm:text-sm text-center sm:text-left">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono text-yellow-400">
              {getMidPrice(currentTick).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 sm:h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] sm:text-xs text-gray-500">
          <span>{allTicks.length.toLocaleString()} ticks</span>
          <span>{currentTickIndex.toLocaleString()} procesados</span>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ backgroundColor: colors.background, height: dimensions.height }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          onMouseMove={(e) => {
            handleMouseMove(e);
            handleMouseMoveDrag(e);
          }}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="cursor-crosshair touch-none"
        />
      </div>

      {/* Price levels legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 bg-slate-800 rounded-lg text-[13px] sm:text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-0.5"
            style={{ backgroundColor: colors.entryLine }}
          />
          <span className="text-gray-400">Entry:</span>
          <span className="font-mono text-white">
            {trade.entryPrice.toFixed(2)}
          </span>
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
            levelColors={colors.levelColors}
          />
        </div>
      )}

      {/* Synthetic ticks warning */}
      {!hasRealTicks && ticks.length === 0 && (
        <p className="text-yellow-400 text-sm text-center py-2">
          Sin ticks reales - simulando con ticks sintéticos
        </p>
      )}
    </div>
  );
}
