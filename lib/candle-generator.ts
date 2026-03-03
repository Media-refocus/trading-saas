/**
 * Generador de velas sintéticas desde TradeDetails
 *
 * Crea velas OHLC a partir de los datos de trades del backtest.
 * Útil cuando no hay datos de ticks reales disponibles.
 */

import type { OHLC } from "./candle-compression";
import type { TradeDetail, Side } from "./backtest-engine";

/**
 * TradeMarker para EnhancedCandleViewer
 */
export interface TradeMarker {
  id: string;
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  side: "BUY" | "SELL";
  profit: number;
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL";
}

/**
 * Genera velas OHLC sintéticas a partir de TradeDetails
 *
 * Estrategia:
 * 1. Ordenar trades por tiempo de entrada
 * 2. Para cada trade, generar velas interpoladas entre entry y exit
 * 3. Añadir velas de "quiet market" entre trades si hay gaps de tiempo
 *
 * @param trades - Lista de TradeDetail del backtest
 * @param intervalMinutes - Intervalo de velas en minutos (default: 1)
 * @param volatilityPips - Volatilidad base en pips para generar high/low (default: 5)
 */
export function generateSyntheticCandles(
  trades: TradeDetail[],
  intervalMinutes: number = 1,
  volatilityPips: number = 5
): OHLC[] {
  if (trades.length === 0) return [];

  const PIP_VALUE = 0.1; // Para XAUUSD
  const volatility = volatilityPips * PIP_VALUE;
  const intervalSeconds = intervalMinutes * 60;

  // Ordenar trades por tiempo de entrada
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
  );

  const candles: OHLC[] = [];
  let lastPrice: number | null = null;

  for (let i = 0; i < sortedTrades.length; i++) {
    const trade = sortedTrades[i];
    const entryTime = new Date(trade.entryTime).getTime();
    const exitTime = new Date(trade.exitTime).getTime();
    const entryPrice = trade.entryPrice;
    const exitPrice = trade.exitPrice;
    const side = trade.signalSide;

    // Si hay gap con el trade anterior, generar velas de transición
    if (lastPrice !== null && i > 0) {
      const prevExitTime = new Date(sortedTrades[i - 1].exitTime).getTime();
      const gapMs = entryTime - prevExitTime;

      // Si hay más de 5 minutos de gap, generar velas de transición
      if (gapMs > 5 * 60 * 1000) {
        const transitionCandles = generateTransitionCandles(
          lastPrice,
          entryPrice,
          prevExitTime,
          entryTime,
          intervalSeconds,
          volatility * 0.5 // Menos volatilidad en transiciones
        );
        candles.push(...transitionCandles);
      }
    }

    // Generar velas para el trade actual
    const tradeCandles = generateTradeCandles(
      trade,
      intervalSeconds,
      volatility,
      lastPrice
    );
    candles.push(...tradeCandles);

    lastPrice = exitPrice;
  }

  // Ordenar y deduplicar velas por timestamp
  const candleMap = new Map<number, OHLC>();
  for (const candle of candles) {
    const existing = candleMap.get(candle.time);
    if (!existing || candle.time > 0) {
      candleMap.set(candle.time, candle);
    }
  }

  return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * Genera velas para un trade específico
 */
function generateTradeCandles(
  trade: TradeDetail,
  intervalSeconds: number,
  volatility: number,
  lastPrice: number | null
): OHLC[] {
  const candles: OHLC[] = [];

  const entryTime = new Date(trade.entryTime).getTime() / 1000;
  const exitTime = new Date(trade.exitTime).getTime() / 1000;
  const entryPrice = trade.entryPrice;
  const exitPrice = trade.exitPrice;
  const side = trade.signalSide;

  // Calcular número de velas necesarias
  const durationSeconds = exitTime - entryTime;
  const numCandles = Math.max(1, Math.ceil(durationSeconds / intervalSeconds));

  // Interpolación lineal de precios
  for (let i = 0; i < numCandles; i++) {
    const progress = numCandles > 1 ? i / (numCandles - 1) : 0;
    const candleTime = Math.floor(entryTime + i * intervalSeconds);

    // Precio base interpolado
    const basePrice = entryPrice + (exitPrice - entryPrice) * progress;

    // Añadir variación para high/low
    const variation = volatility * (0.5 + Math.random() * 0.5);

    // Determinar open: primer vela usa entryPrice, resto usa close anterior
    const open = i === 0
      ? (lastPrice !== null ? (lastPrice + entryPrice) / 2 : entryPrice)
      : candles[i - 1].close;

    // Determinar close: última vela usa exitPrice
    const close = i === numCandles - 1 ? exitPrice : basePrice + (Math.random() - 0.5) * volatility;

    // High siempre por encima de open y close
    const high = Math.max(open, close) + Math.random() * variation;

    // Low siempre por debajo de open y close
    const low = Math.min(open, close) - Math.random() * variation;

    candles.push({
      time: candleTime,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });
  }

  return candles;
}

/**
 * Genera velas de transición entre dos trades
 */
function generateTransitionCandles(
  fromPrice: number,
  toPrice: number,
  fromTime: number,
  toTime: number,
  intervalSeconds: number,
  volatility: number
): OHLC[] {
  const candles: OHLC[] = [];

  const fromTimestamp = Math.floor(fromTime / 1000);
  const toTimestamp = Math.floor(toTime / 1000);
  const durationSeconds = toTimestamp - fromTimestamp;

  if (durationSeconds <= 0) return candles;

  const numCandles = Math.floor(durationSeconds / intervalSeconds);
  if (numCandles <= 0) return candles;

  // Interpolación suave
  for (let i = 0; i < numCandles; i++) {
    const progress = i / numCandles;
    const candleTime = Math.floor(fromTimestamp + i * intervalSeconds);

    // Precio interpolado con pequeña variación
    const basePrice = fromPrice + (toPrice - fromPrice) * progress;
    const variation = volatility * Math.random();

    const open = i === 0 ? fromPrice : candles[i - 1].close;
    const close = basePrice + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * variation;
    const low = Math.min(open, close) - Math.random() * variation;

    candles.push({
      time: candleTime,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });
  }

  return candles;
}

/**
 * Mapea TradeDetail[] a TradeMarker[] para EnhancedCandleViewer
 */
export function mapTradesToMarkers(trades: TradeDetail[]): TradeMarker[] {
  return trades.map((trade, index) => ({
    id: `trade-${index}-${trade.signalTimestamp}`,
    entryTime: new Date(trade.entryTime),
    exitTime: new Date(trade.exitTime),
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    side: trade.signalSide,
    profit: trade.totalProfit,
    exitReason: mapExitReason(trade.exitReason),
  }));
}

/**
 * Mapea el motivo de salida al formato de TradeMarker
 */
function mapExitReason(
  reason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL" | "SIGNAL_CLOSE"
): "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL" {
  // SIGNAL_CLOSE se mapea a STOP_LOSS como fallback
  if (reason === "SIGNAL_CLOSE") return "STOP_LOSS";
  return reason;
}

/**
 * Extiende las velas para cubrir un rango de tiempo completo
 * Añade velas antes del primer trade y después del último
 */
export function extendCandleRange(
  candles: OHLC[],
  trades: TradeDetail[],
  paddingMinutes: number = 60
): OHLC[] {
  if (candles.length === 0 || trades.length === 0) return candles;

  const extendedCandles = [...candles];
  const PIP_VALUE = 0.1;

  // Añadir velas antes del primer trade
  const firstCandle = candles[0];
  const firstTrade = trades.sort(
    (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
  )[0];
  const firstTradeTime = Math.floor(new Date(firstTrade.entryTime).getTime() / 1000);

  // Añadir padding al inicio
  const startPadding = Math.floor(paddingMinutes * 60 / 60); // velas de 1 min
  let lastPrice = firstCandle.open;

  for (let i = 1; i <= startPadding; i++) {
    const candleTime = firstCandle.time - i * 60;
    const variation = PIP_VALUE * 2 * Math.random();
    const close = lastPrice + (Math.random() - 0.5) * PIP_VALUE;
    const open = lastPrice;

    extendedCandles.unshift({
      time: candleTime,
      open: Math.round(open * 100) / 100,
      high: Math.round(Math.max(open, close) + variation * 100) / 100,
      low: Math.round(Math.min(open, close) - variation * 100) / 100,
      close: Math.round(close * 100) / 100,
    });

    lastPrice = close;
  }

  // Añadir padding al final
  const lastCandle = candles[candles.length - 1];
  lastPrice = lastCandle.close;

  for (let i = 1; i <= startPadding; i++) {
    const candleTime = lastCandle.time + i * 60;
    const variation = PIP_VALUE * 2 * Math.random();
    const close = lastPrice + (Math.random() - 0.5) * PIP_VALUE;
    const open = lastPrice;

    extendedCandles.push({
      time: candleTime,
      open: Math.round(open * 100) / 100,
      high: Math.round(Math.max(open, close) + variation * 100) / 100,
      low: Math.round(Math.min(open, close) - variation * 100) / 100,
      close: Math.round(close * 100) / 100,
    });

    lastPrice = close;
  }

  return extendedCandles.sort((a, b) => a.time - b.time);
}
