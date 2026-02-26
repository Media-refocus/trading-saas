/**
 * Ticks Database - Consultas de ticks usando better-sqlite3
 *
 * VERSIÓN CON BETTER-SQLITE3
 * Evita problemas de conversión de Prisma con timestamps
 */

import Database from "better-sqlite3";
import * as path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

// Crear conexión singleton
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(dbPath, { readonly: true, fileMustExist: true });
    // No podemos cambiar pragmas en modo readonly
  }
  return _db;
}

export interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

// Parsear timestamp string a Date
function parseTimestamp(ts: string): Date {
  // Si no tiene Z, añadirlo
  if (!ts.endsWith("Z") && !ts.endsWith("+")) {
    ts = ts + "Z";
  }
  return new Date(ts);
}

/**
 * Obtiene ticks en un rango de fechas
 */
export async function getTicksFromDB(
  startTime: Date,
  endTime: Date,
  symbol: string = "XAUUSD"
): Promise<Tick[]> {
  const db = getDb();

  const startStr = startTime.toISOString().replace("Z", "");
  const endStr = endTime.toISOString().replace("Z", "");

  const rows = db.prepare(`
    SELECT timestamp, bid, ask, spread
    FROM TickData
    WHERE symbol = ?
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY timestamp ASC
  `).all(symbol, startStr, endStr) as { timestamp: string; bid: number; ask: number; spread: number }[];

  return rows.map((row) => ({
    timestamp: parseTimestamp(row.timestamp),
    bid: row.bid,
    ask: row.ask,
    spread: row.spread,
  }));
}

/**
 * Obtiene el precio de mercado más cercano a un timestamp
 */
export async function getMarketPrice(
  timestamp: Date,
  symbol: string = "XAUUSD",
  toleranceMs: number = 5 * 60 * 1000
): Promise<{ bid: number; ask: number; spread: number } | null> {
  const db = getDb();

  const startStr = new Date(timestamp.getTime() - toleranceMs).toISOString().replace("Z", "");
  const endStr = new Date(timestamp.getTime() + toleranceMs).toISOString().replace("Z", "");

  const rows = db.prepare(`
    SELECT timestamp, bid, ask, spread
    FROM TickData
    WHERE symbol = ?
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY ABS(julianday(timestamp) - julianday(?))
    LIMIT 1
  `).all(symbol, startStr, endStr, timestamp.toISOString().replace("Z", "")) as { timestamp: string; bid: number; ask: number; spread: number }[];

  if (rows.length === 0) {
    return null;
  }

  return {
    bid: rows[0].bid,
    ask: rows[0].ask,
    spread: rows[0].spread,
  };
}

/**
 * Obtiene el primer tick disponible
 */
export async function getFirstTick(symbol: string = "XAUUSD"): Promise<Tick | null> {
  const db = getDb();

  const row = db.prepare(`
    SELECT timestamp, bid, ask, spread
    FROM TickData
    WHERE symbol = ?
    ORDER BY timestamp ASC
    LIMIT 1
  `).get(symbol) as { timestamp: string; bid: number; ask: number; spread: number } | undefined;

  if (!row) return null;

  return {
    timestamp: parseTimestamp(row.timestamp),
    bid: row.bid,
    ask: row.ask,
    spread: row.spread,
  };
}

/**
 * Obtiene el último tick disponible
 */
export async function getLastTick(symbol: string = "XAUUSD"): Promise<Tick | null> {
  const db = getDb();

  const row = db.prepare(`
    SELECT timestamp, bid, ask, spread
    FROM TickData
    WHERE symbol = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(symbol) as { timestamp: string; bid: number; ask: number; spread: number } | undefined;

  if (!row) return null;

  return {
    timestamp: parseTimestamp(row.timestamp),
    bid: row.bid,
    ask: row.ask,
    spread: row.spread,
  };
}

/**
 * Cuenta el total de ticks en la BD
 */
export async function getTicksCount(symbol: string = "XAUUSD"): Promise<number> {
  const db = getDb();

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM TickData WHERE symbol = ?
  `).get(symbol) as { count: number };

  return row.count;
}

/**
 * Obtiene estadísticas de la BD de ticks
 */
export async function getTicksStats(): Promise<{
  totalTicks: number;
  firstTick: Date | null;
  lastTick: Date | null;
  symbols: string[];
  estimatedSizeMB: number;
}> {
  const db = getDb();

  const countRow = db.prepare("SELECT COUNT(*) as count FROM TickData").get() as { count: number };
  const firstRow = db.prepare("SELECT timestamp FROM TickData ORDER BY timestamp ASC LIMIT 1").get() as { timestamp: string } | undefined;
  const lastRow = db.prepare("SELECT timestamp FROM TickData ORDER BY timestamp DESC LIMIT 1").get() as { timestamp: string } | undefined;
  const symbolsRow = db.prepare("SELECT DISTINCT symbol FROM TickData").all() as { symbol: string }[];

  return {
    totalTicks: countRow.count,
    firstTick: firstRow ? parseTimestamp(firstRow.timestamp) : null,
    lastTick: lastRow ? parseTimestamp(lastRow.timestamp) : null,
    symbols: symbolsRow.map((r) => r.symbol),
    estimatedSizeMB: Math.round((countRow.count * 48) / 1024 / 1024), // ~48 bytes per tick
  };
}

/**
 * Verifica si la BD tiene datos
 */
export async function isTicksDBReady(): Promise<boolean> {
  try {
    const count = await getTicksCount();
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Obtiene el siguiente tick después de un timestamp
 */
export async function getNextTickAfter(
  timestamp: Date,
  symbol: string = "XAUUSD",
  maxDelayMs: number = 60 * 1000
): Promise<Tick | null> {
  const db = getDb();

  const startStr = timestamp.toISOString().replace("Z", "");
  const endStr = new Date(timestamp.getTime() + maxDelayMs).toISOString().replace("Z", "");

  const row = db.prepare(`
    SELECT timestamp, bid, ask, spread
    FROM TickData
    WHERE symbol = ?
      AND timestamp > ?
      AND timestamp <= ?
    ORDER BY timestamp ASC
    LIMIT 1
  `).get(symbol, startStr, endStr) as { timestamp: string; bid: number; ask: number; spread: number } | undefined;

  if (!row) return null;

  return {
    timestamp: parseTimestamp(row.timestamp),
    bid: row.bid,
    ask: row.ask,
    spread: row.spread,
  };
}

// Cerrar conexión al terminar el proceso
process.on("beforeExit", () => {
  if (_db) {
    _db.close();
    _db = null;
  }
});
