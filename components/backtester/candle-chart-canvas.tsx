"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getThemeColors } from "@/lib/chart-themes";
import type { OHLC } from "@/lib/candle-compression";

// ==================== TYPES ====================

interface TradeMarker {
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  side: "BUY" | "SELL";
}

interface CandleChartCanvasProps {
  candles: OHLC[];
  visibleStart?: number;
  visibleCount?: number;
  currentCandleIndex?: number;
  tradeMarkers?: TradeMarker[];
  config?: {
    takeProfitPips?: number;
  };
  themeId?: string;
  className?: string;
}

// ==================== CONSTANTS ====================

const PIP_VALUE = 0.1;
const CANDLE_BODY_RATIO = 0.65;

// ==================== COMPONENT ====================

export function CandleChartCanvas({
  candles,
  visibleStart: externalVisibleStart,
  visibleCount: externalVisibleCount = 60,
  currentCandleIndex = 0,
  tradeMarkers = [],
  config = {},
  themeId = "mt5",
  className,
}: CandleChartCanvasProps) {
  const colors = getThemeColors(themeId);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isMobile, setIsMobile] = useState(false);

  // Calculate visible range
  const visibleCount = externalVisibleCount;
  const visibleStart = externalVisibleStart ?? Math.max(0, candles.length - visibleCount);
  const visibleEnd = Math.min(candles.length, visibleStart + visibleCount);
  const visibleCandles = candles.slice(visibleStart, visibleEnd);

  // Calculate price range with padding
  const priceRange = useCallback(() => {
    if (visibleCandles.length === 0) {
      return { min: 0, max: 1 };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const c of visibleCandles) {
      min = Math.min(min, c.low);
      max = Math.max(max, c.high);
    }

    // Add trade markers to range
    for (const trade of tradeMarkers) {
      min = Math.min(min, trade.entryPrice, trade.exitPrice);
      max = Math.max(max, trade.entryPrice, trade.exitPrice);

      // Add TP/SL
      const isBuy = trade.side === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + (config.takeProfitPips ?? 50) * PIP_VALUE
        : trade.entryPrice - (config.takeProfitPips ?? 50) * PIP_VALUE;
      const slPrice = isBuy
        ? trade.entryPrice - 50 * PIP_VALUE
        : trade.entryPrice + 50 * PIP_VALUE;

      min = Math.min(min, tpPrice, slPrice);
      max = Math.max(max, tpPrice, slPrice);
    }

    // Add padding
    const padding = (max - min) * 0.1 || 1;
    return { min: min - padding, max: max + padding };
  }, [visibleCandles, tradeMarkers, config]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({
        width: rect.width || 800,
        height: rect.height || 400,
      });
      setIsMobile(window.innerWidth < 768);
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    window.addEventListener("resize", updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Draw chart
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

    // Chart area with room for labels
    const padding = { top: 20, right: 75, bottom: 35, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear with theme background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Get visible candles
    if (visibleCandles.length === 0) {
      ctx.fillStyle = colors.text;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay datos", width / 2, height / 2);
      return;
    }

    const { min: minPrice, max: maxPrice } = priceRange();
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

    // Horizontal grid (price) - with labels
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (priceRangeValue * i) / priceSteps;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Price labels on Y-axis (right side)
      ctx.fillStyle = colors.text;
      ctx.font = `${isMobile ? 10 : 11}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 4);
    }

    // Vertical grid (time) - with labels
    const timeSteps = Math.min(6, visibleCandles.length);
    for (let i = 0; i < timeSteps; i++) {
      const idx = Math.floor((i / Math.max(1, timeSteps - 1)) * (visibleCandles.length - 1));
      const x = indexToX(idx);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Time labels on X-axis (bottom)
      if (visibleCandles[idx]) {
        const date = new Date(visibleCandles[idx].time * 1000);
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
    for (let i = 0; i < visibleCandles.length; i++) {
      const candle = visibleCandles[i];
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

      // Highlight current candle in playback
      if (i === currentCandleIndex - visibleStart && currentCandleIndex >= visibleStart && currentCandleIndex < visibleEnd) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - candleBodyWidth / 2 - 2, bodyTop - 2, candleBodyWidth + 4, bodyHeight + 4);
      }
    }

    // Draw trade markers
    for (const trade of tradeMarkers) {
      const isBuy = trade.side === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + (config.takeProfitPips ?? 50) * PIP_VALUE
        : trade.entryPrice - (config.takeProfitPips ?? 50) * PIP_VALUE;
      const slPrice = isBuy
        ? trade.entryPrice - 50 * PIP_VALUE
        : trade.entryPrice + 50 * PIP_VALUE;

      // Entry line - SOLID BLUE
      const entryY = priceToY(trade.entryPrice);
      ctx.strokeStyle = "#2196f3";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();

      ctx.fillStyle = "#2196f3";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Entry ${trade.entryPrice.toFixed(2)}`, width - padding.right + 5, entryY + 4);

      // TP line - GREEN DASHED
      const tpY = priceToY(tpPrice);
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();

      ctx.fillStyle = "#4caf50";
      ctx.fillText(`TP ${tpPrice.toFixed(2)}`, width - padding.right + 5, tpY + 4);

      // SL line - RED DASHED
      const slY = priceToY(slPrice);
      ctx.strokeStyle = "#f44336";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, slY);
      ctx.lineTo(width - padding.right, slY);
      ctx.stroke();

      ctx.fillStyle = "#f44336";
      ctx.fillText(`SL ${slPrice.toFixed(2)}`, width - padding.right + 5, slY + 4);

      ctx.setLineDash([]);
    }

    // Draw playback position indicator
    if (currentCandleIndex >= 0 && currentCandleIndex < candles.length) {
      const relativeIndex = currentCandleIndex - visibleStart;
      if (relativeIndex >= 0 && relativeIndex < visibleCandles.length) {
        const x = indexToX(relativeIndex);

        // Vertical line at current position
        ctx.strokeStyle = "#0078D4";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [dimensions, visibleCandles, visibleStart, visibleCount, priceRange, colors, tradeMarkers, config, isMobile, currentCandleIndex, candles.length]);

  // Render on state changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  return (
    <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
