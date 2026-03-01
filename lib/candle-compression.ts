/**
 * Compresión de Velas OHLC
 *
 * Algoritmos para comprimir velas de timeframe menor a mayor.
 * Permite mostrar operativas largas sin saturar el navegador.
 *
 * Ejemplo: 1000 velas de 1min → 167 velas de 5min → 33 velas de 15min
 */

// ==================== TYPES ====================

export type TimeframeMinutes = 1 | 5 | 15 | 60 | 240 | 1440;

export interface OHLC {
  time: number;      // Unix timestamp en segundos
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CompressionLevel {
  timeframe: TimeframeMinutes;
  threshold: number;  // Número de velas original antes de activar compresión
}

export interface CompressionResult {
  candles: OHLC[];
  originalCount: number;
  compressedCount: number;
  timeframe: TimeframeMinutes;
  compressionRatio: number;
}

// Compresión por defecto: umbrales para cada timeframe
const DEFAULT_COMPRESSION_LEVELS: CompressionLevel[] = [
  { timeframe: 1, threshold: 0 },      // Siempre 1min
  { timeframe: 5, threshold: 500 },    // >500 velas → 5min
  { timeframe: 15, threshold: 1000 },  // >1000 velas → 15min
  { timeframe: 60, threshold: 2000 },  // >2000 velas → 1H
  { timeframe: 240, threshold: 5000 }, // >5000 velas → 4H
  { timeframe: 1440, threshold: 10000 }, // >10000 velas → Diario
];

// ==================== COMPRESSION FUNCTIONS ====================

/**
 * Comprime velas de un timeframe a otro mayor
 */
export function compressCandles(
  candles: OHLC[],
  fromTimeframe: TimeframeMinutes,
  toTimeframe: TimeframeMinutes
): OHLC[] {
  if (candles.length === 0) return [];
  if (fromTimeframe >= toTimeframe) return candles;

  const ratio = toTimeframe / fromTimeframe;
  const result: OHLC[] = [];

  // Agrupar velas por período del timeframe destino
  const groups = new Map<number, OHLC[]>();

  for (const candle of candles) {
    // Calcular el timestamp del inicio del período destino
    const periodStart = Math.floor(candle.time / (toTimeframe * 60)) * (toTimeframe * 60);

    if (!groups.has(periodStart)) {
      groups.set(periodStart, []);
    }
    groups.get(periodStart)!.push(candle);
  }

  // Comprimir cada grupo en una vela
  for (const [periodStart, group] of groups) {
    if (group.length === 0) continue;

    // Ordenar por tiempo
    group.sort((a, b) => a.time - b.time);

    const compressed: OHLC = {
      time: periodStart,
      open: group[0].open,
      high: Math.max(...group.map(c => c.high)),
      low: Math.min(...group.map(c => c.low)),
      close: group[group.length - 1].close,
    };

    // Sumar volúmenes si existen
    if (group.some(c => c.volume !== undefined)) {
      compressed.volume = group.reduce((sum, c) => sum + (c.volume || 0), 0);
    }

    result.push(compressed);
  }

  // Ordenar resultado por tiempo
  return result.sort((a, b) => a.time - b.time);
}

/**
 * Determina el timeframe óptimo basado en el número de velas
 * y el viewport disponible
 */
export function getOptimalTimeframe(
  candleCount: number,
  viewportCandles: number = 100,
  levels: CompressionLevel[] = DEFAULT_COMPRESSION_LEVELS
): TimeframeMinutes {
  // Si las velas caben en el viewport, no comprimir
  if (candleCount <= viewportCandles) {
    return 1;
  }

  // Encontrar el nivel de compresión apropiado
  for (let i = levels.length - 1; i >= 0; i--) {
    if (candleCount >= levels[i].threshold) {
      return levels[i].timeframe;
    }
  }

  return 1;
}

/**
 * Comprime velas automáticamente según el count y viewport
 */
export function autoCompressCandles(
  candles: OHLC[],
  viewportCandles: number = 100,
  levels: CompressionLevel[] = DEFAULT_COMPRESSION_LEVELS
): CompressionResult {
  if (candles.length === 0) {
    return {
      candles: [],
      originalCount: 0,
      compressedCount: 0,
      timeframe: 1,
      compressionRatio: 1,
    };
  }

  const originalCount = candles.length;
  const optimalTimeframe = getOptimalTimeframe(originalCount, viewportCandles, levels);

  // Si no necesita compresión
  if (optimalTimeframe === 1 || originalCount <= viewportCandles) {
    return {
      candles,
      originalCount,
      compressedCount: originalCount,
      timeframe: 1,
      compressionRatio: 1,
    };
  }

  // Comprimir al timeframe óptimo
  const compressed = compressCandles(candles, 1, optimalTimeframe);

  return {
    candles: compressed,
    originalCount,
    compressedCount: compressed.length,
    timeframe: optimalTimeframe,
    compressionRatio: originalCount / compressed.length,
  };
}

/**
 * Cache de compresión para evitar recalcular
 */
export class CompressionCache {
  private cache = new Map<string, CompressionResult>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  private getKey(candles: OHLC[], viewportCandles: number): string {
    // Crear key basada en primera/última vela y count
    if (candles.length === 0) return "empty";

    const first = candles[0].time;
    const last = candles[candles.length - 1].time;
    return `${first}-${last}-${candles.length}-${viewportCandles}`;
  }

  get(candles: OHLC[], viewportCandles: number): CompressionResult | null {
    const key = this.getKey(candles, viewportCandles);
    return this.cache.get(key) || null;
  }

  set(candles: OHLC[], viewportCandles: number, result: CompressionResult): void {
    const key = this.getKey(candles, viewportCandles);

    // Limpiar cache si está lleno
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, result);
  }

  getOrCompress(
    candles: OHLC[],
    viewportCandles: number
  ): CompressionResult {
    const cached = this.get(candles, viewportCandles);
    if (cached) return cached;

    const result = autoCompressCandles(candles, viewportCandles);
    this.set(candles, viewportCandles, result);
    return result;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Instancia global del cache
export const compressionCache = new CompressionCache();

// ==================== AGGREGATION HELPERS ====================

/**
 * Convierte ticks a velas OHLC de un timeframe específico
 */
export function ticksToCandles(
  ticks: Array<{ timestamp: Date; bid: number; ask: number }>,
  timeframeMinutes: TimeframeMinutes = 1
): OHLC[] {
  if (ticks.length === 0) return [];

  const intervalSeconds = timeframeMinutes * 60;
  const candleMap = new Map<number, OHLC>();

  for (const tick of ticks) {
    const price = (tick.bid + tick.ask) / 2;
    const time = Math.floor(tick.timestamp.getTime() / 1000);
    const candleTime = Math.floor(time / intervalSeconds) * intervalSeconds;

    const existing = candleMap.get(candleTime);
    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    } else {
      candleMap.set(candleTime, {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    }
  }

  return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * Formatea timeframe para mostrar en UI
 */
export function formatTimeframe(tf: TimeframeMinutes): string {
  switch (tf) {
    case 1: return "1min";
    case 5: return "5min";
    case 15: return "15min";
    case 60: return "1H";
    case 240: return "4H";
    case 1440: return "1D";
    default: return `${tf}min`;
  }
}
