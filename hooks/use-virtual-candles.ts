/**
 * Hook para Virtual Scrolling de Velas
 *
 * Gestiona el viewport virtual para renderizar solo las velas visibles + buffer.
 * Optimizado para manejar 10,000+ velas sin lag perceptible.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ==================== TYPES ====================

export interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VirtualCandleConfig {
  viewportWidth: number;      // Ancho del viewport en píxeles
  candleWidth: number;        // Ancho de cada vela en píxeles
  candleGap: number;          // Espacio entre velas
  bufferCount: number;        // Velas de buffer antes/después
  maxRendered: number;        // Máximo de velas a renderizar
}

export interface VirtualCandleRange {
  startIndex: number;         // Índice de la primera vela visible
  endIndex: number;           // Índice de la última vela visible
  visibleCandles: OHLC[];     // Velas en el rango visible + buffer
  offsetX: number;            // Offset en píxeles para posicionar
  totalWidth: number;         // Ancho total del scroll
}

export interface VirtualScrollState {
  scrollX: number;            // Posición actual del scroll
  zoom: number;               // Nivel de zoom (1 = normal)
  isAtStart: boolean;         // Si está al inicio
  isAtEnd: boolean;           // Si está al final
}

const DEFAULT_CONFIG: VirtualCandleConfig = {
  viewportWidth: 800,
  candleWidth: 8,
  candleGap: 2,
  bufferCount: 50,
  maxRendered: 500,
};

// ==================== HOOK ====================

export function useVirtualCandles(
  candles: OHLC[],
  config: Partial<VirtualCandleConfig> = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const [scrollState, setScrollState] = useState<VirtualScrollState>({
    scrollX: 0,
    zoom: 1,
    isAtStart: true,
    isAtEnd: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Ancho efectivo de cada vela (incluyendo gap)
  const effectiveCandleWidth = useMemo(() => {
    return (finalConfig.candleWidth + finalConfig.candleGap) * scrollState.zoom;
  }, [finalConfig.candleWidth, finalConfig.candleGap, scrollState.zoom]);

  // Ancho total del contenido
  const totalWidth = useMemo(() => {
    return candles.length * effectiveCandleWidth;
  }, [candles.length, effectiveCandleWidth]);

  // Calcular rango visible
  const virtualRange = useMemo((): VirtualCandleRange => {
    if (candles.length === 0) {
      return {
        startIndex: 0,
        endIndex: 0,
        visibleCandles: [],
        offsetX: 0,
        totalWidth: 0,
      };
    }

    const { viewportWidth, bufferCount, maxRendered } = finalConfig;

    // Calcular índices basados en scroll position
    const startIndexRaw = Math.floor(scrollState.scrollX / effectiveCandleWidth);
    const visibleCount = Math.ceil(viewportWidth / effectiveCandleWidth);

    // Aplicar buffer
    const startIndex = Math.max(0, startIndexRaw - bufferCount);
    const endIndexRaw = Math.min(
      candles.length - 1,
      startIndexRaw + visibleCount + bufferCount
    );

    // Limitar a máximo renderizado
    const maxEndIndex = Math.min(startIndex + maxRendered, candles.length - 1);
    const endIndex = Math.min(endIndexRaw, maxEndIndex);

    // Velas visibles
    const visibleCandles = candles.slice(startIndex, endIndex + 1);

    // Offset para posicionar las velas
    const offsetX = startIndex * effectiveCandleWidth - scrollState.scrollX;

    return {
      startIndex,
      endIndex,
      visibleCandles,
      offsetX,
      totalWidth,
    };
  }, [candles, scrollState.scrollX, effectiveCandleWidth, finalConfig, totalWidth]);

  // Actualizar estado del scroll
  const handleScroll = useCallback((newScrollX: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setScrollState((prev) => {
        const clampedScrollX = Math.max(0, Math.min(newScrollX, totalWidth - finalConfig.viewportWidth));

        return {
          ...prev,
          scrollX: clampedScrollX,
          isAtStart: clampedScrollX <= 0,
          isAtEnd: clampedScrollX >= totalWidth - finalConfig.viewportWidth - 1,
        };
      });
    });
  }, [totalWidth, finalConfig.viewportWidth]);

  // Navegar a un índice específico
  const scrollToIndex = useCallback((index: number) => {
    const targetX = index * effectiveCandleWidth - finalConfig.viewportWidth / 2;
    handleScroll(Math.max(0, targetX));
  }, [effectiveCandleWidth, finalConfig.viewportWidth, handleScroll]);

  // Navegar al inicio
  const scrollToStart = useCallback(() => {
    handleScroll(0);
  }, [handleScroll]);

  // Navegar al final
  const scrollToEnd = useCallback(() => {
    handleScroll(totalWidth - finalConfig.viewportWidth);
  }, [handleScroll, totalWidth, finalConfig.viewportWidth]);

  // Ajustar zoom
  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(0.5, Math.min(4, newZoom));

    setScrollState((prev) => {
      // Ajustar scroll para mantener el centro
      const centerRatio = prev.scrollX / totalWidth || 0;

      return {
        ...prev,
        zoom: clampedZoom,
      };
    });
  }, [totalWidth]);

  // Zoom in/out
  const zoomIn = useCallback(() => {
    setScrollState((prev) => ({
      ...prev,
      zoom: Math.min(4, prev.zoom * 1.2),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setScrollState((prev) => ({
      ...prev,
      zoom: Math.max(0.5, prev.zoom / 1.2),
    }));
  }, []);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Manejar resize del contenedor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && width !== finalConfig.viewportWidth) {
          // Actualizar estado para trigger re-cálculo
          setScrollState((prev) => ({ ...prev }));
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [finalConfig.viewportWidth]);

  // Manejar wheel para scroll horizontal
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Solo scroll horizontal, no zoom
    const delta = e.deltaX || e.deltaY;
    if (Math.abs(delta) > 0) {
      e.preventDefault();
      handleScroll(scrollState.scrollX + delta);
    }
  }, [handleScroll, scrollState.scrollX]);

  return {
    // Estado
    scrollState,
    virtualRange,
    containerRef,

    // Acciones de navegación
    handleScroll,
    scrollToIndex,
    scrollToStart,
    scrollToEnd,

    // Acciones de zoom
    setZoom,
    zoomIn,
    zoomOut,

    // Event handlers
    handleWheel,

    // Utilidades
    effectiveCandleWidth,
    totalWidth,
  };
}

// ==================== HELPERS ====================

/**
 * Calcula el timeframe óptimo basado en el número de velas y zoom
 */
export function getOptimalTimeframe(
  candleCount: number,
  viewportWidth: number,
  candleWidth: number
): "1" | "5" | "15" | "60" | "240" | "1440" {
  const visibleCandles = Math.floor(viewportWidth / candleWidth);

  // Si caben pocas velas, usar timeframe alto
  if (candleCount > visibleCandles * 100) return "1440"; // Diario
  if (candleCount > visibleCandles * 50) return "240";   // 4H
  if (candleCount > visibleCandles * 20) return "60";    // 1H
  if (candleCount > visibleCandles * 10) return "15";    // 15min
  if (candleCount > visibleCandles * 5) return "5";      // 5min
  return "1"; // 1min
}

/**
 * Formatea timestamp para eje X del gráfico
 */
export function formatCandleTime(timestamp: number, timeframe: string): string {
  const date = new Date(timestamp * 1000);

  switch (timeframe) {
    case "1":
    case "5":
    case "15":
      return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    case "60":
      return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    case "240":
    case "1440":
      return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    default:
      return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
}
