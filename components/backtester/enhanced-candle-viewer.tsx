"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  PeriodSelector,
  PeriodSelectorMobile,
  getPeriodDateRange,
  type PeriodOption,
  type VisualizationMode,
} from "./period-selector";
import { PlaybackControls, PlaybackStatus } from "./playback-controls";
import {
  autoCompressCandles,
  formatTimeframe,
  type OHLC,
  type TimeframeMinutes,
} from "@/lib/candle-compression";
import { useVirtualCandles } from "@/hooks/use-virtual-candles";

// ==================== TYPES ====================

interface TradeMarker {
  id: string;
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  side: "BUY" | "SELL";
  profit: number;
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL";
}

interface EnhancedCandleViewerProps {
  candles: OHLC[];
  trades?: TradeMarker[];
  isLoading?: boolean;
  config?: {
    takeProfitPips?: number;
    pipsDistance?: number;
    maxLevels?: number;
  };
  onPeriodChange?: (from: Date, to: Date) => void;
  className?: string;
}

// ==================== CONSTANTS ====================

const PIP_VALUE = 0.1;
const SPEED_INTERVALS: Record<number, number> = {
  1: 500,
  2: 250,
  4: 125,
  8: 60,
  16: 30,
  32: 15,
  50: 10,
};

// ==================== COMPONENT ====================

export function EnhancedCandleViewer({
  candles,
  trades = [],
  isLoading = false,
  config = {},
  onPeriodChange,
  className,
}: EnhancedCandleViewerProps) {
  // State
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [mode, setMode] = useState<VisualizationMode>("detail");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentCandleIndex, setCurrentCandleIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Filter candles by period
  const filteredCandles = useMemo(() => {
    if (!candles.length) return [];

    const { from, to } = getPeriodDateRange(period);
    const fromTs = Math.floor(from.getTime() / 1000);
    const toTs = Math.floor(to.getTime() / 1000);

    return candles.filter((c) => c.time >= fromTs && c.time <= toTs);
  }, [candles, period]);

  // Compress candles based on mode and count
  const compressedData = useMemo(() => {
    if (mode === "detail") {
      // Detail mode: show raw candles, but compress if too many
      if (filteredCandles.length > 500) {
        return autoCompressCandles(filteredCandles, 200);
      }
      return {
        candles: filteredCandles,
        originalCount: filteredCandles.length,
        compressedCount: filteredCandles.length,
        timeframe: 1 as TimeframeMinutes,
        compressionRatio: 1,
      };
    }

    if (mode === "operative") {
      // Operative mode: compress to show all trades
      return autoCompressCandles(filteredCandles, 150);
    }

    // Overview mode: heavy compression for equity view
    return autoCompressCandles(filteredCandles, 80);
  }, [filteredCandles, mode]);

  // Virtual scrolling for large datasets
  const virtualScroll = useVirtualCandles(compressedData.candles, {
    viewportWidth: isMobile ? 375 : 800,
    candleWidth: mode === "overview" ? 12 : 8,
    candleGap: 2,
    bufferCount: 30,
    maxRendered: 300,
  });

  // Filter trades by period
  const filteredTrades = useMemo(() => {
    if (!trades.length) return [];

    const { from, to } = getPeriodDateRange(period);
    return trades.filter((t) => {
      const tradeTime = new Date(t.entryTime);
      return tradeTime >= from && tradeTime <= to;
    });
  }, [trades, period]);

  // Handle period change
  const handlePeriodChange = useCallback(
    (newPeriod: PeriodOption) => {
      setPeriod(newPeriod);
      setProgress(0);
      setCurrentCandleIndex(0);
      setIsPlaying(false);

      if (onPeriodChange) {
        const { from, to } = getPeriodDateRange(newPeriod);
        onPeriodChange(from, to);
      }
    },
    [onPeriodChange]
  );

  // Handle mode change
  const handleModeChange = useCallback((newMode: VisualizationMode) => {
    setMode(newMode);
    setIsPlaying(false);
    setProgress(0);
    setCurrentCandleIndex(0);
  }, []);

  // Playback controls
  const handlePlay = useCallback(() => {
    if (compressedData.candles.length === 0) return;
    setIsPlaying(true);
  }, [compressedData.candles.length]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentCandleIndex(0);
    virtualScroll.scrollToStart();
  }, [virtualScroll]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  const handleSeek = useCallback(
    (newProgress: number) => {
      const newIndex = Math.floor(
        (newProgress / 100) * (compressedData.candles.length - 1)
      );
      setCurrentCandleIndex(newIndex);
      setProgress(newProgress);
      virtualScroll.scrollToIndex(newIndex);
    },
    [compressedData.candles.length, virtualScroll]
  );

  // Playback effect
  useEffect(() => {
    if (!isPlaying || compressedData.candles.length === 0) {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
      return;
    }

    const interval = SPEED_INTERVALS[speed] || 500;

    playbackRef.current = setInterval(() => {
      setCurrentCandleIndex((prev) => {
        const next = prev + 1;
        if (next >= compressedData.candles.length - 1) {
          setIsPlaying(false);
          return compressedData.candles.length - 1;
        }

        // Update progress
        const newProgress = (next / (compressedData.candles.length - 1)) * 100;
        setProgress(newProgress);

        // Scroll to keep visible
        virtualScroll.scrollToIndex(next);

        return next;
      });
    }, interval);

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
    };
  }, [isPlaying, speed, compressedData.candles.length, virtualScroll]);

  // Current time for display
  const currentTime = useMemo(() => {
    if (compressedData.candles.length === 0 || currentCandleIndex === 0) {
      return "--:--";
    }
    const candle = compressedData.candles[currentCandleIndex];
    return new Date(candle.time * 1000).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [compressedData.candles, currentCandleIndex]);

  // Stats for playback status
  const stats = useMemo(() => {
    const completedTrades = filteredTrades.filter(
      (t) =>
        t.entryTime <=
        new Date(
          compressedData.candles[currentCandleIndex]?.time * 1000 || 0
        )
    );

    const balance = completedTrades.reduce(
      (sum, t) => sum + t.profit,
      10000 // Starting balance
    );

    const floatingPL = 0; // Would need position tracking for real value

    return {
      currentTrade: completedTrades.length,
      totalTrades: filteredTrades.length,
      balance,
      equity: balance + floatingPL,
      floatingPL,
    };
  }, [filteredTrades, compressedData.candles, currentCandleIndex]);

  return (
    <div className={cn("flex flex-col bg-[#1E1E1E]", className)}>
      {/* Period & Mode Selector */}
      {isMobile ? (
        <PeriodSelectorMobile
          selectedPeriod={period}
          selectedMode={mode}
          onPeriodChange={handlePeriodChange}
          onModeChange={handleModeChange}
          isLoading={isLoading}
        />
      ) : (
        <PeriodSelector
          selectedPeriod={period}
          selectedMode={mode}
          onPeriodChange={handlePeriodChange}
          onModeChange={handleModeChange}
          isLoading={isLoading}
          tradeCount={filteredTrades.length}
          dateRange={getPeriodDateRange(period)}
        />
      )}

      {/* Compression info */}
      {compressedData.compressionRatio > 1 && (
        <div className="flex items-center gap-2 px-4 py-1 bg-[#252526] text-xs text-[#888888]">
          <span>
            {compressedData.originalCount.toLocaleString()} velas →{" "}
            {compressedData.compressedCount.toLocaleString()} ({formatTimeframe(compressedData.timeframe)})
          </span>
          <span className="text-[#0078D4]">
            {compressedData.compressionRatio.toFixed(1)}x compresión
          </span>
        </div>
      )}

      {/* Playback Status */}
      {mode !== "overview" && (
        <PlaybackStatus
          currentTrade={stats.currentTrade}
          totalTrades={stats.totalTrades}
          balance={stats.balance}
          equity={stats.equity}
          floatingPL={stats.floatingPL}
        />
      )}

      {/* Chart Area - Placeholder for now */}
      <div
        ref={containerRef}
        className="flex-1 min-h-[300px] md:min-h-[400px] relative overflow-hidden"
        onWheel={virtualScroll.handleWheel}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-[#888888]">
              <div className="w-5 h-5 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
              <span>Cargando velas...</span>
            </div>
          </div>
        ) : compressedData.candles.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#888888]">
            <span>No hay datos para el período seleccionado</span>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {/* Virtual scroll container */}
            <div
              className="absolute inset-0"
              style={{
                transform: `translateX(${-virtualScroll.scrollState.scrollX}px)`,
              }}
            >
              {/* Candle rendering would go here */}
              {/* For now, show info about visible candles */}
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-[#888888]">
                  <div className="text-lg font-mono">
                    {virtualScroll.virtualRange.startIndex} -{" "}
                    {virtualScroll.virtualRange.endIndex} /{" "}
                    {compressedData.candles.length}
                  </div>
                  <div className="text-xs mt-1">
                    {virtualScroll.virtualRange.visibleCandles.length} velas
                    visibles
                  </div>
                  <div className="text-xs mt-2 text-[#0078D4]">
                    Zoom: {virtualScroll.scrollState.zoom.toFixed(1)}x
                  </div>
                </div>
              </div>
            </div>

            {/* Trade markers overlay */}
            {mode !== "overview" && filteredTrades.length > 0 && (
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {filteredTrades.slice(0, 5).map((trade, i) => (
                  <div
                    key={trade.id}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-mono",
                      trade.profit >= 0
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    )}
                  >
                    #{i + 1} {trade.side === "BUY" ? "↑" : "↓"}{" "}
                    {trade.profit >= 0 ? "+" : ""}
                    {trade.profit.toFixed(0)}€
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <PlaybackControls
        isPlaying={isPlaying}
        speed={speed}
        progress={progress}
        currentTime={currentTime}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSpeedChange={handleSpeedChange}
        onSeek={handleSeek}
      />

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[#252526] border-t border-[#3C3C3C]">
        <button
          onClick={virtualScroll.zoomOut}
          className="px-3 py-1 rounded text-xs bg-[#333333] hover:bg-[#444444] text-[#888888] hover:text-white transition-colors"
        >
          Zoom Out
        </button>
        <span className="text-xs text-[#888888] font-mono min-w-[60px] text-center">
          {virtualScroll.scrollState.zoom.toFixed(1)}x
        </span>
        <button
          onClick={virtualScroll.zoomIn}
          className="px-3 py-1 rounded text-xs bg-[#333333] hover:bg-[#444444] text-[#888888] hover:text-white transition-colors"
        >
          Zoom In
        </button>
        <div className="w-px h-4 bg-[#3C3C3C] mx-2" />
        <button
          onClick={virtualScroll.scrollToStart}
          disabled={virtualScroll.scrollState.isAtStart}
          className="px-3 py-1 rounded text-xs bg-[#333333] hover:bg-[#444444] text-[#888888] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Inicio
        </button>
        <button
          onClick={virtualScroll.scrollToEnd}
          disabled={virtualScroll.scrollState.isAtEnd}
          className="px-3 py-1 rounded text-xs bg-[#333333] hover:bg-[#444444] text-[#888888] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Final
        </button>
      </div>
    </div>
  );
}

// ==================== HELPER HOOK ====================

/**
 * Hook para generar datos de ejemplo para testing
 */
export function useDemoCandles(count: number = 10000): OHLC[] {
  return useMemo(() => {
    const candles: OHLC[] = [];
    let price = 2000 + Math.random() * 100; // XAUUSD around 2000-2100
    const now = Math.floor(Date.now() / 1000);
    const interval = 60; // 1 min candles

    for (let i = 0; i < count; i++) {
      const time = now - (count - i) * interval;
      const volatility = 0.5 + Math.random() * 2;
      const change = (Math.random() - 0.5) * volatility;

      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;

      candles.push({
        time,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
      });

      price = close;
    }

    return candles;
  }, [count]);
}
