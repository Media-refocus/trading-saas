"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { getThemeColors } from "@/lib/chart-themes";
import type { OHLC } from "@/lib/candle-compression";
import type { MALine } from "./ma-overlay";

// ==================== TYPES ====================

interface TradeMarker {
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  side: "BUY" | "SELL";
  profit?: number;
}

interface EquityPoint {
  time: number;
  equity: number;
}

interface VolumeBar {
  time: number;
  volume: number;
}

interface CandleChartCanvasProps {
  candles: OHLC[];
  visibleStart?: number;
  visibleCount?: number;
  currentCandleIndex?: number;
  tradeMarkers?: TradeMarker[];
  equityCurve?: EquityPoint[];
  volumeBars?: VolumeBar[];
  maLines?: MALine[];
  config?: {
    takeProfitPips?: number;
  };
  themeId?: string;
  className?: string;
  onZoomChange?: (zoom: number) => void;
  showEquityCurve?: boolean;
  showVolume?: boolean;
  onExportPng?: () => void;
}

interface TouchState {
  // Panning
  isPanning: boolean;
  panStartX: number;
  panStartOffsetX: number;
  lastPanX: number;
  lastPanTime: number;
  velocityX: number;

  // Pinch zoom (horizontal)
  isPinching: boolean;
  pinchStartDist: number;
  pinchStartScaleX: number;
  pinchCenterX: number;

  // Price axis drag (vertical Y zoom)
  isDraggingPriceAxis: boolean;
  priceAxisStartY: number;
  priceAxisStartScaleY: number;

  // Long press crosshair
  longPressTimer: ReturnType<typeof setTimeout> | null;
  isCrosshairActive: boolean;
  crosshairX: number;
  crosshairY: number;

  // Double tap
  lastTapTime: number;
}

// ==================== CONSTANTS ====================

const PRICE_AXIS_WIDTH = 65;
const TIME_AXIS_HEIGHT = 30;
const TOP_PADDING = 12;
const LEFT_PADDING = 6;
const MIN_CANDLES_VISIBLE = 15;
const MAX_CANDLES_VISIBLE = 600;
const LONG_PRESS_MS = 300;
const DOUBLE_TAP_MS = 300;
const MOMENTUM_FRICTION = 0.95;
const MOMENTUM_MIN_VELOCITY = 0.5;

// MT5 colors
const MT5 = {
  bg: "#000000",
  candleUp: "#26a69a",
  candleDown: "#ef5350",
  grid: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.6)",
  textBright: "rgba(255,255,255,0.85)",
  currentPrice: "#00bcd4",
  crosshair: "rgba(255,255,255,0.3)",
  tooltipBg: "rgba(20,20,20,0.95)",
  tooltipBorder: "rgba(255,255,255,0.15)",
};

// ==================== COMPONENT ====================

export function CandleChartCanvas({
  candles,
  visibleStart: _externalVisibleStart,
  visibleCount: externalVisibleCount = 60,
  currentCandleIndex = 0,
  tradeMarkers = [],
  equityCurve = [],
  volumeBars = [],
  maLines = [],
  config = {},
  themeId = "mt5",
  className,
  onZoomChange,
  showEquityCurve = false,
  showVolume = false,
  onExportPng,
}: CandleChartCanvasProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const equityCanvasRef = useRef<HTMLCanvasElement>(null);
  const volumeCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const momentumRef = useRef<number>(0);
  const touchRef = useRef<TouchState>({
    isPanning: false,
    panStartX: 0,
    panStartOffsetX: 0,
    lastPanX: 0,
    lastPanTime: 0,
    velocityX: 0,
    isPinching: false,
    pinchStartDist: 0,
    pinchStartScaleX: 0,
    pinchCenterX: 0,
    isDraggingPriceAxis: false,
    priceAxisStartY: 0,
    priceAxisStartScaleY: 0,
    longPressTimer: null,
    isCrosshairActive: false,
    crosshairX: 0,
    crosshairY: 0,
    lastTapTime: 0,
  });

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Chart state — internal scroll/zoom
  const [offsetX, setOffsetX] = useState(0); // scroll position (candle units from end)
  const [scaleX, setScaleX] = useState(externalVisibleCount); // candles visible
  const [scaleY, setScaleY] = useState(1.0); // Y zoom multiplier
  const [isAutoFitY, setIsAutoFitY] = useState(true);
  const [crosshair, setCrosshair] = useState<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  // Mouse state for desktop
  const [mouseInside, setMouseInside] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Chart geometry helpers
  const chartWidth = dimensions.width - LEFT_PADDING - PRICE_AXIS_WIDTH;
  const chartHeight = dimensions.height - TOP_PADDING - TIME_AXIS_HEIGHT;

  // Calculate visible range
  const visibleCandlesCount = Math.max(MIN_CANDLES_VISIBLE, Math.min(MAX_CANDLES_VISIBLE, Math.round(scaleX)));
  const visibleEnd = Math.max(0, candles.length - Math.round(offsetX));
  const visibleStart = Math.max(0, visibleEnd - visibleCandlesCount);
  const visibleCandles = candles.slice(visibleStart, visibleEnd);

  // Price range calculation — fit ONLY to valid visible candles (skip price=0)
  const priceRange = useMemo(() => {
    if (visibleCandles.length === 0) return { min: 0, max: 1, center: 0.5 };

    let min = Infinity;
    let max = -Infinity;
    let validCount = 0;
    for (const c of visibleCandles) {
      // Skip candles with zero or invalid prices
      if (c.low <= 0 || c.high <= 0 || !isFinite(c.low) || !isFinite(c.high)) continue;
      min = Math.min(min, c.low);
      max = Math.max(max, c.high);
      validCount++;
    }

    // If no valid prices found, return default
    if (validCount === 0 || !isFinite(min) || !isFinite(max)) return { min: 0, max: 1, center: 0.5 };

    // Ensure minimum visible spread (at least 0.5% of price)
    const center = (max + min) / 2;
    const minSpread = Math.max(center * 0.005, 10);
    const rawSpread = max - min;
    if (rawSpread < minSpread) {
      min = center - minSpread / 2;
      max = center + minSpread / 2;
    }

    // Add 10% padding on each side
    const spread = max - min;
    const padding = spread * 0.1;
    min -= padding;
    max += padding;

    // Apply manual Y scale if user has zoomed
    if (!isAutoFitY) {
      const halfRange = (spread / 2) * scaleY;
      return { min: center - halfRange, max: center + halfRange, center };
    }

    // Debug: log price range (remove after fixing)
    if (typeof window !== 'undefined') {
      console.log(`PRICERANGE: min=${min.toFixed(2)} max=${max.toFixed(2)} validCount=${validCount} totalCandles=${visibleCandles.length}`);
    }

    return { min, max, center };
  }, [visibleCandles, isAutoFitY, scaleY]);

  // Coordinate transforms
  const priceToY = useCallback(
    (price: number) => {
      const range = priceRange.max - priceRange.min || 1;
      return TOP_PADDING + chartHeight - ((price - priceRange.min) / range) * chartHeight;
    },
    [priceRange, chartHeight]
  );

  const yToPrice = useCallback(
    (y: number) => {
      const range = priceRange.max - priceRange.min || 1;
      return priceRange.min + ((TOP_PADDING + chartHeight - y) / chartHeight) * range;
    },
    [priceRange, chartHeight]
  );

  const indexToX = useCallback(
    (i: number) => {
      if (visibleCandles.length === 0) return 0;
      const candleW = chartWidth / visibleCandles.length;
      return LEFT_PADDING + i * candleW + candleW / 2;
    },
    [visibleCandles.length, chartWidth]
  );

  const xToIndex = useCallback(
    (x: number) => {
      if (visibleCandles.length === 0) return -1;
      const candleW = chartWidth / visibleCandles.length;
      return Math.floor((x - LEFT_PADDING) / candleW);
    },
    [visibleCandles.length, chartWidth]
  );

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width || 800, height: rect.height || 400 });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ==================== DRAWING ====================

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Background — pure black
    ctx.fillStyle = MT5.bg;
    ctx.fillRect(0, 0, width, height);

    if (visibleCandles.length === 0) {
      ctx.fillStyle = MT5.text;
      ctx.font = "13px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay datos de velas", width / 2, height / 2);
      return;
    }

    const candleW = chartWidth / visibleCandles.length;
    const bodyW = Math.max(1, candleW * 0.7 - 1);

    // ---- Grid lines ----
    ctx.strokeStyle = MT5.grid;
    ctx.lineWidth = 1;

    // Horizontal grid + price labels
    const priceRangeVal = priceRange.max - priceRange.min || 1;
    const rawStep = priceRangeVal / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const nice = [1, 2, 5, 10].find((n) => n * mag >= rawStep) || 10;
    const step = nice * mag;
    const firstPrice = Math.ceil(priceRange.min / step) * step;

    ctx.font = "11px monospace";
    for (let p = firstPrice; p <= priceRange.max; p += step) {
      const y = priceToY(p);
      if (y < TOP_PADDING || y > TOP_PADDING + chartHeight) continue;
      ctx.beginPath();
      ctx.moveTo(LEFT_PADDING, y);
      ctx.lineTo(LEFT_PADDING + chartWidth, y);
      ctx.stroke();

      // Price label
      ctx.fillStyle = MT5.text;
      ctx.textAlign = "left";
      ctx.fillText(p.toFixed(2), LEFT_PADDING + chartWidth + 6, y + 4);
    }

    // Vertical grid + time labels
    const maxTimeLabels = Math.max(3, Math.floor(chartWidth / 100));
    const timeStep = Math.max(1, Math.floor(visibleCandles.length / maxTimeLabels));
    ctx.font = "10px monospace";
    for (let i = 0; i < visibleCandles.length; i += timeStep) {
      const x = indexToX(i);
      ctx.strokeStyle = MT5.grid;
      ctx.beginPath();
      ctx.moveTo(x, TOP_PADDING);
      ctx.lineTo(x, TOP_PADDING + chartHeight);
      ctx.stroke();

      const date = new Date(visibleCandles[i].time * 1000);
      const label =
        visibleCandles.length > 200
          ? date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
          : date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      ctx.fillStyle = MT5.text;
      ctx.textAlign = "center";
      ctx.fillText(label, x, height - TIME_AXIS_HEIGHT + 18);
    }

    // ---- Candles ----
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const x = indexToX(i);
      const bull = c.close >= c.open;
      const color = bull ? MT5.candleUp : MT5.candleDown;

      const oY = priceToY(c.open);
      const cY = priceToY(c.close);
      const hY = priceToY(c.high);
      const lY = priceToY(c.low);

      // Wick — 1px
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, hY);
      ctx.lineTo(x, lY);
      ctx.stroke();

      // Body — min 2px height for visibility
      const top = Math.min(oY, cY);
      const h = Math.max(2, Math.abs(cY - oY));
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x - bodyW / 2), Math.round(top), Math.round(bodyW), Math.round(h));
    }

    // ---- MA Lines ----
    for (const ma of maLines) {
      if (!ma.values || ma.values.length === 0) continue;
      ctx.strokeStyle = ma.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < visibleCandles.length; i++) {
        const mv = ma.values.find((v) => v.time === visibleCandles[i].time);
        if (!mv || mv.value === null) continue;
        const x = indexToX(i);
        const y = priceToY(mv.value);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // ---- Trade arrows ----
    for (const trade of tradeMarkers) {
      const entryTs = Math.floor(new Date(trade.entryTime).getTime() / 1000);
      const idx = visibleCandles.findIndex((c) => c.time === entryTs);
      if (idx < 0) continue;

      const x = indexToX(idx);
      const c = visibleCandles[idx];
      const isBuy = trade.side === "BUY";
      const arrowY = isBuy ? priceToY(c.low) + 14 : priceToY(c.high) - 14;
      const sz = 8;

      ctx.fillStyle = isBuy ? "#22c55e" : "#ef4444";
      ctx.beginPath();
      if (isBuy) {
        ctx.moveTo(x, arrowY);
        ctx.lineTo(x - sz / 2, arrowY + sz);
        ctx.lineTo(x + sz / 2, arrowY + sz);
      } else {
        ctx.moveTo(x, arrowY);
        ctx.lineTo(x - sz / 2, arrowY - sz);
        ctx.lineTo(x + sz / 2, arrowY - sz);
      }
      ctx.closePath();
      ctx.fill();
    }

    // ---- Current price badge ----
    if (visibleCandles.length > 0) {
      const lastCandle = visibleCandles[visibleCandles.length - 1];
      const currentPrice = lastCandle.close;
      const cpY = priceToY(currentPrice);

      // Dashed line across chart
      ctx.strokeStyle = MT5.currentPrice;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(LEFT_PADDING, cpY);
      ctx.lineTo(LEFT_PADDING + chartWidth, cpY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badge on price axis
      const badgeW = PRICE_AXIS_WIDTH - 4;
      const badgeH = 18;
      const badgeX = LEFT_PADDING + chartWidth + 2;
      const badgeY = cpY - badgeH / 2;
      ctx.fillStyle = MT5.currentPrice;
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(currentPrice.toFixed(2), badgeX + badgeW / 2, badgeY + 13);
    }

    // ---- Crosshair (touch or desktop) ----
    const showCrosshair = crosshair.active || (mouseInside && !crosshair.active);
    const cx = crosshair.active ? crosshair.x : mousePos.x;
    const cy = crosshair.active ? crosshair.y : mousePos.y;

    if (showCrosshair && cx > LEFT_PADDING && cx < LEFT_PADDING + chartWidth && cy > TOP_PADDING && cy < TOP_PADDING + chartHeight) {
      const hoverIdx = xToIndex(cx);

      // Dashed lines
      ctx.strokeStyle = MT5.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(cx, TOP_PADDING);
      ctx.lineTo(cx, TOP_PADDING + chartHeight);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(LEFT_PADDING, cy);
      ctx.lineTo(LEFT_PADDING + chartWidth, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label at crosshair Y
      const chPrice = yToPrice(cy);
      ctx.fillStyle = "#0078D4";
      ctx.fillRect(LEFT_PADDING + chartWidth + 1, cy - 9, PRICE_AXIS_WIDTH - 2, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(chPrice.toFixed(2), LEFT_PADDING + chartWidth + PRICE_AXIS_WIDTH / 2, cy + 4);

      // OHLC tooltip
      if (hoverIdx >= 0 && hoverIdx < visibleCandles.length) {
        const candle = visibleCandles[hoverIdx];
        const date = new Date(candle.time * 1000);
        const dateStr = date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
        const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

        const tw = 135;
        const th = 90;
        const tx = cx + 20 + tw > width ? cx - tw - 10 : cx + 20;
        const ty = Math.max(TOP_PADDING + 4, Math.min(cy - 45, TOP_PADDING + chartHeight - th));

        ctx.fillStyle = MT5.tooltipBg;
        ctx.strokeStyle = MT5.tooltipBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 10px monospace";
        ctx.fillStyle = MT5.textBright;
        ctx.textAlign = "left";
        ctx.fillText(`${dateStr} ${timeStr}`, tx + 8, ty + 16);

        const labels = ["O", "H", "L", "C"];
        const vals = [candle.open, candle.high, candle.low, candle.close];
        const colors = [MT5.text, MT5.candleUp, MT5.candleDown, candle.close >= candle.open ? MT5.candleUp : MT5.candleDown];

        ctx.font = "10px monospace";
        labels.forEach((l, j) => {
          const ly = ty + 32 + j * 14;
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fillText(`${l}:`, tx + 8, ly);
          ctx.fillStyle = colors[j];
          ctx.fillText(vals[j].toFixed(2), tx + 28, ly);
        });
      }
    }
  }, [
    dimensions,
    visibleCandles,
    priceRange,
    chartWidth,
    chartHeight,
    priceToY,
    yToPrice,
    indexToX,
    xToIndex,
    tradeMarkers,
    maLines,
    crosshair,
    mouseInside,
    mousePos,
  ]);

  // ==================== TOUCH HANDLERS ====================

  const getTouchDist = (t1: Touch, t2: Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const isInPriceAxis = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return x > dimensions.width - PRICE_AXIS_WIDTH;
  };

  const clearLongPress = () => {
    const ts = touchRef.current;
    if (ts.longPressTimer) {
      clearTimeout(ts.longPressTimer);
      ts.longPressTimer = null;
    }
  };

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const ts = touchRef.current;
      clearLongPress();

      // Stop momentum
      if (momentumRef.current) {
        cancelAnimationFrame(momentumRef.current);
        momentumRef.current = 0;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = touch.clientX - rect.left;

        // Double tap detection
        const now = Date.now();
        if (now - ts.lastTapTime < DOUBLE_TAP_MS) {
          // Double tap — reset Y to auto-fit
          setIsAutoFitY(true);
          setScaleY(1.0);
          ts.lastTapTime = 0;
          return;
        }
        ts.lastTapTime = now;

        if (isInPriceAxis(touch.clientX)) {
          // Price axis drag — Y zoom
          ts.isDraggingPriceAxis = true;
          ts.priceAxisStartY = touch.clientY;
          ts.priceAxisStartScaleY = scaleY;
        } else {
          // Pan
          ts.isPanning = true;
          ts.panStartX = touch.clientX;
          ts.panStartOffsetX = offsetX;
          ts.lastPanX = touch.clientX;
          ts.lastPanTime = Date.now();
          ts.velocityX = 0;

          // Long press for crosshair
          ts.longPressTimer = setTimeout(() => {
            ts.isCrosshairActive = true;
            const y = touch.clientY - (rect?.top || 0);
            setCrosshair({ active: true, x, y });
          }, LONG_PRESS_MS);
        }
      } else if (e.touches.length === 2) {
        // Pinch zoom
        clearLongPress();
        ts.isPanning = false;
        ts.isCrosshairActive = false;
        setCrosshair({ active: false, x: 0, y: 0 });

        ts.isPinching = true;
        ts.pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
        ts.pinchStartScaleX = scaleX;
        ts.pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      }
    },
    [offsetX, scaleX, scaleY]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const ts = touchRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (ts.isPinching && e.touches.length === 2) {
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const ratio = ts.pinchStartDist / dist; // inverse: pinch out = more candles
        const newScale = Math.max(
          MIN_CANDLES_VISIBLE,
          Math.min(MAX_CANDLES_VISIBLE, ts.pinchStartScaleX * ratio)
        );
        setScaleX(newScale);
        onZoomChange?.(newScale);
      } else if (ts.isDraggingPriceAxis && e.touches.length === 1) {
        const dy = e.touches[0].clientY - ts.priceAxisStartY;
        // Drag down = expand range (scaleY increases)
        const sensitivity = 0.005;
        const newScaleY = Math.max(0.2, Math.min(5, ts.priceAxisStartScaleY + dy * sensitivity));
        setScaleY(newScaleY);
        setIsAutoFitY(false);
      } else if (ts.isPanning && e.touches.length === 1) {
        const touch = e.touches[0];

        // If moved enough, cancel long press
        if (Math.abs(touch.clientX - ts.panStartX) > 8) {
          clearLongPress();
          ts.isCrosshairActive = false;
          setCrosshair({ active: false, x: 0, y: 0 });
        }

        if (ts.isCrosshairActive) {
          // Move crosshair
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          setCrosshair({ active: true, x, y });
        } else {
          // Pan
          const dx = touch.clientX - ts.lastPanX;
          const now = Date.now();
          const dt = now - ts.lastPanTime || 1;
          ts.velocityX = dx / dt;
          ts.lastPanX = touch.clientX;
          ts.lastPanTime = now;

          const totalDx = touch.clientX - ts.panStartX;
          const candleW = chartWidth / visibleCandlesCount;
          const candlesDelta = totalDx / candleW;

          setOffsetX(Math.max(0, Math.min(candles.length - visibleCandlesCount, ts.panStartOffsetX + candlesDelta)));
        }
      }
    },
    [chartWidth, visibleCandlesCount, candles.length, onZoomChange]
  );

  const startMomentum = useCallback(
    (velocity: number) => {
      let v = velocity * 15; // scale up
      const tick = () => {
        v *= MOMENTUM_FRICTION;
        if (Math.abs(v) < MOMENTUM_MIN_VELOCITY) return;
        setOffsetX((prev) => {
          const candleW = chartWidth / visibleCandlesCount;
          const delta = v / (candleW || 1);
          return Math.max(0, Math.min(candles.length - visibleCandlesCount, prev + delta));
        });
        momentumRef.current = requestAnimationFrame(tick);
      };
      momentumRef.current = requestAnimationFrame(tick);
    },
    [chartWidth, visibleCandlesCount, candles.length]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const ts = touchRef.current;
      clearLongPress();

      if (ts.isPanning && !ts.isCrosshairActive && Math.abs(ts.velocityX) > 0.1) {
        startMomentum(ts.velocityX);
      }

      ts.isPanning = false;
      ts.isPinching = false;
      ts.isDraggingPriceAxis = false;

      if (ts.isCrosshairActive && e.touches.length === 0) {
        ts.isCrosshairActive = false;
        setCrosshair({ active: false, x: 0, y: 0 });
      }
    },
    [startMomentum]
  );

  // ==================== MOUSE HANDLERS (desktop) ====================

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setMouseInside(true);
    },
    []
  );

  const handleMouseLeave = useCallback(() => setMouseInside(false), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Vertical zoom
        const dy = e.deltaY * 0.003;
        setScaleY((prev) => Math.max(0.2, Math.min(5, prev + dy)));
        setIsAutoFitY(false);
      } else {
        // Horizontal zoom
        const delta = e.deltaY * 0.5;
        setScaleX((prev) => Math.max(MIN_CANDLES_VISIBLE, Math.min(MAX_CANDLES_VISIBLE, prev + delta)));
      }
    },
    []
  );

  // ==================== ATTACH TOUCH EVENTS ====================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // ==================== RENDER LOOP ====================

  useEffect(() => {
    draw();
  }, [draw]);

  // ==================== EQUITY CURVE ====================

  useEffect(() => {
    if (!showEquityCurve || !equityCanvasRef.current || equityCurve.length === 0) return;
    const canvas = equityCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width;
    const h = 100;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = MT5.bg;
    ctx.fillRect(0, 0, w, h);

    const pad = { t: 10, r: PRICE_AXIS_WIDTH, b: 20, l: LEFT_PADDING };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;

    const minE = Math.min(...equityCurve.map((p) => p.equity));
    const maxE = Math.max(...equityCurve.map((p) => p.equity));
    const range = maxE - minE || 1;

    ctx.strokeStyle = "#0078D4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    equityCurve.forEach((p, i) => {
      const x = pad.l + (i / (equityCurve.length - 1)) * cw;
      const y = pad.t + ch - ((p.equity - minE) / range) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = MT5.text;
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`$${maxE.toFixed(0)}`, w - pad.r + 5, pad.t + 10);
    ctx.fillText(`$${minE.toFixed(0)}`, w - pad.r + 5, h - pad.b);
  }, [showEquityCurve, equityCurve, dimensions]);

  // ==================== VOLUME BARS ====================

  useEffect(() => {
    if (!showVolume || !volumeCanvasRef.current || volumeBars.length === 0) return;
    const canvas = volumeCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width;
    const h = 60;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = MT5.bg;
    ctx.fillRect(0, 0, w, h);

    const pad = { t: 5, r: PRICE_AXIS_WIDTH, b: 15, l: LEFT_PADDING };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;

    const visBars = volumeBars.slice(visibleStart, visibleEnd);
    const maxVol = Math.max(...visBars.map((v) => v.volume), 1);
    const barW = cw / visBars.length;

    visBars.forEach((vol, i) => {
      const x = pad.l + i * barW + barW * 0.2;
      const bh = (vol.volume / maxVol) * ch;
      const y = pad.t + ch - bh;
      const candle = visibleCandles[i];
      const bull = candle && candle.close >= candle.open;
      ctx.fillStyle = bull ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)";
      ctx.fillRect(x, y, barW * 0.6, bh);
    });
  }, [showVolume, volumeBars, dimensions, visibleStart, visibleEnd, visibleCandles]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", flex: 1, display: "block", touchAction: "none" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
      {showVolume && volumeBars.length > 0 && (
        <canvas
          ref={volumeCanvasRef}
          style={{ width: "100%", height: 60, display: "block", borderTop: "1px solid #1a1a1a" }}
        />
      )}
      {showEquityCurve && equityCurve.length > 0 && (
        <canvas
          ref={equityCanvasRef}
          style={{ width: "100%", height: 100, display: "block", borderTop: "1px solid #1a1a1a" }}
        />
      )}
    </div>
  );
}
