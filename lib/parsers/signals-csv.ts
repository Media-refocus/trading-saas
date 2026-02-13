/**
 * Parser de señales desde CSV
 *
 * Formato esperado (signals_simple.csv):
 * ts_utc;kind;side;price_hint;range_id;message_id;confidence
 */

import { Side } from "../backtest-engine";

export interface RawSignal {
  timestamp: Date;
  kind: "range_open" | "range_close";
  side: Side | null;
  priceHint: number | null;
  rangeId: string;
  messageId: number;
  confidence: number | null;
}

export interface TradingSignal {
  id: string;
  timestamp: Date;
  side: Side;
  entryPrice: number;
  closeTimestamp?: Date;
  closePrice?: number;
  rangeId: string;
  confidence: number;
}

/**
 * Parsea una línea CSV a RawSignal
 */
function parseCsvLine(line: string): RawSignal | null {
  const parts = line.split(";");
  if (parts.length < 7) return null;

  const [tsUtc, kind, side, priceHint, rangeId, messageId, confidence] = parts;

  return {
    timestamp: new Date(tsUtc),
    kind: kind as "range_open" | "range_close",
    side: side === "BUY" || side === "SELL" ? (side as Side) : null,
    priceHint: priceHint ? parseFloat(priceHint) : null,
    rangeId: rangeId || "",
    messageId: messageId ? parseInt(messageId, 10) : 0,
    confidence: confidence ? parseFloat(confidence) : null,
  };
}

/**
 * Parsea contenido CSV completo a array de RawSignals
 */
export function parseSignalsCsv(content: string): RawSignal[] {
  const lines = content.trim().split("\n");
  const signals: RawSignal[] = [];

  // Saltar header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const signal = parseCsvLine(line);
    if (signal) {
      signals.push(signal);
    }
  }

  return signals;
}

/**
 * Convierte RawSignals a TradingSignals (pares open/close)
 */
export function groupSignalsByRange(rawSignals: RawSignal[]): TradingSignal[] {
  const rangeMap = new Map<string, { open: RawSignal; close?: RawSignal }>();

  for (const signal of rawSignals) {
    if (signal.kind === "range_open") {
      rangeMap.set(signal.rangeId, { open: signal });
    } else if (signal.kind === "range_close") {
      const existing = rangeMap.get(signal.rangeId);
      if (existing) {
        existing.close = signal;
      }
    }
  }

  const tradingSignals: TradingSignal[] = [];

  for (const [rangeId, { open, close }] of rangeMap) {
    if (!open.side || !open.priceHint) continue;

    tradingSignals.push({
      id: rangeId,
      timestamp: open.timestamp,
      side: open.side,
      entryPrice: open.priceHint,
      closeTimestamp: close?.timestamp,
      closePrice: close ? open.priceHint : undefined, // Usamos precio de entrada como referencia
      rangeId,
      confidence: open.confidence || 0.95,
    });
  }

  // Ordenar por timestamp
  return tradingSignals.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

/**
 * Carga señales desde un archivo CSV en el servidor
 */
export async function loadSignalsFromFile(
  filePath: string
): Promise<TradingSignal[]> {
  const fs = await import("fs");
  const content = fs.readFileSync(filePath, "utf-8");
  const rawSignals = parseSignalsCsv(content);
  return groupSignalsByRange(rawSignals);
}

/**
 * Genera ticks sintéticos para simular movimiento de precio
 * (Se usa cuando no hay datos reales de ticks)
 */
export function generateSyntheticTicks(
  entryPrice: number,
  exitPrice: number,
  durationMs: number,
  volatilityPips: number = 50
): { timestamp: Date; bid: number; ask: number; spread: number }[] {
  const ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] =
    [];

  const PIP_VALUE = 0.1;
  const spread = 0.1; // 1 pip de spread típico
  const numTicks = Math.max(10, Math.floor(durationMs / 60000)); // 1 tick por minuto mínimo

  const startTs = Date.now() - durationMs;
  const priceDiff = exitPrice - entryPrice;
  const volatility = volatilityPips * PIP_VALUE;

  for (let i = 0; i <= numTicks; i++) {
    const progress = i / numTicks;

    // Precio base con tendencia hacia el destino
    let basePrice = entryPrice + priceDiff * progress;

    // Añadir ruido aleatorio (random walk)
    const noise = (Math.random() - 0.5) * 2 * volatility * Math.sin(progress * Math.PI);
    basePrice += noise;

    ticks.push({
      timestamp: new Date(startTs + (durationMs * i) / numTicks),
      bid: basePrice,
      ask: basePrice + spread,
      spread,
    });
  }

  return ticks;
}
