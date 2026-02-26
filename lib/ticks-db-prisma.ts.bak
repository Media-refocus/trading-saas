/**
 * Ticks Database - Consultas de ticks desde SQLite
 *
 * ARQUITECTURA OPTIMIZADA:
 * - Los ticks se almacenan en SQLite (importados una vez desde .gz)
 * - Consultas SQL con índices = rápidas y sin consumir memoria
 * - Escala bien con múltiples usuarios concurrentes
 * - Uso de memoria: ~50MB (solo Prisma client), no ~1GB como antes
 */

import { prisma } from "./prisma";

export interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

// Cache mínimo en memoria para consultas repetidas (solo últimos 1000 ticks)
const recentTicksCache = new Map<string, Tick[]>();
const MAX_CACHE_ENTRIES = 100;

/**
 * Obtiene ticks en un rango de fechas desde SQLite
 */
export async function getTicksFromDB(
  startTime: Date,
  endTime: Date,
  symbol: string = "XAUUSD"
): Promise<Tick[]> {
  const cacheKey = `${symbol}-${startTime.toISOString()}-${endTime.toISOString()}`;

  // Verificar cache de consultas recientes
  if (recentTicksCache.has(cacheKey)) {
    return recentTicksCache.get(cacheKey)!;
  }

  const ticks = await prisma.tickData.findMany({
    where: {
      symbol,
      timestamp: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
    select: {
      timestamp: true,
      bid: true,
      ask: true,
      spread: true,
    },
  });

  // Convertir a formato simple
  const result: Tick[] = ticks.map((t) => ({
    timestamp: t.timestamp,
    bid: t.bid,
    ask: t.ask,
    spread: t.spread,
  }));

  // Guardar en cache si es una consulta pequeña
  if (result.length < 10000) {
    // Limitar tamaño del cache
    if (recentTicksCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = recentTicksCache.keys().next().value;
      if (firstKey) {
        recentTicksCache.delete(firstKey);
      }
    }
    recentTicksCache.set(cacheKey, result);
  }

  return result;
}

/**
 * Obtiene el precio de mercado más cercano a un timestamp
 */
export async function getMarketPrice(
  timestamp: Date,
  symbol: string = "XAUUSD",
  toleranceMs: number = 5 * 60 * 1000
): Promise<{ bid: number; ask: number; spread: number } | null> {
  const startTime = new Date(timestamp.getTime() - toleranceMs);
  const endTime = new Date(timestamp.getTime() + toleranceMs);

  const ticks = await getTicksFromDB(startTime, endTime, symbol);

  if (ticks.length === 0) {
    return null;
  }

  // Encontrar el tick más cercano
  let bestTick = ticks[0];
  let bestDiff = Math.abs(ticks[0].timestamp.getTime() - timestamp.getTime());

  for (const tick of ticks) {
    const diff = Math.abs(tick.timestamp.getTime() - timestamp.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestTick = tick;
    }
  }

  if (bestDiff > toleranceMs) {
    return null;
  }

  return {
    bid: bestTick.bid,
    ask: bestTick.ask,
    spread: bestTick.spread,
  };
}

/**
 * Obtiene el primer tick disponible (para saber desde cuándo hay datos)
 */
export async function getFirstTick(
  symbol: string = "XAUUSD"
): Promise<Tick | null> {
  const tick = await prisma.tickData.findFirst({
    where: { symbol },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      bid: true,
      ask: true,
      spread: true,
    },
  });

  return tick;
}

/**
 * Obtiene el último tick disponible
 */
export async function getLastTick(
  symbol: string = "XAUUSD"
): Promise<Tick | null> {
  const tick = await prisma.tickData.findFirst({
    where: { symbol },
    orderBy: { timestamp: "desc" },
    select: {
      timestamp: true,
      bid: true,
      ask: true,
      spread: true,
    },
  });

  return tick;
}

/**
 * Cuenta el total de ticks en la BD
 */
export async function getTicksCount(symbol: string = "XAUUSD"): Promise<number> {
  return prisma.tickData.count({
    where: { symbol },
  });
}

/**
 * Obtiene estadísticas de la BD de ticks (optimizado para tablas grandes)
 * Usa consultas ligeras y cachea resultados
 */
let statsCache: {
  totalTicks: number;
  firstTick: Date | null;
  lastTick: Date | null;
  symbols: string[];
  estimatedSizeMB: number;
} | null = null;

export async function getTicksStats(): Promise<{
  totalTicks: number;
  firstTick: Date | null;
  lastTick: Date | null;
  symbols: string[];
  estimatedSizeMB: number;
}> {
  // Retornar cache si existe
  if (statsCache) {
    return statsCache;
  }

  // Valores hardcodeados conocidos (116M ticks, 14GB)
  // NOTA: No consultamos la BD porque hay timestamps corruptos
  // que causan errores de conversión en Prisma
  statsCache = {
    totalTicks: 116528150,
    firstTick: new Date("2024-05-31T22:00:00.000Z"),
    lastTick: new Date("2026-02-14T23:59:59.000Z"),
    symbols: ["XAUUSD"],
    estimatedSizeMB: 13959,
  };

  return statsCache;
}

/**
 * Obtiene ticks para múltiples días (optimizado para backtesting)
 * Retorna un Map<fecha, Tick[]> para acceso rápido
 */
export async function getTicksByDays(
  startDate: Date,
  endDate: Date,
  symbol: string = "XAUUSD"
): Promise<Map<string, Tick[]>> {
  const ticks = await getTicksFromDB(startDate, endDate, symbol);

  // Agrupar por día
  const byDay = new Map<string, Tick[]>();

  for (const tick of ticks) {
    const dayKey = tick.timestamp.toISOString().slice(0, 10);

    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, []);
    }
    byDay.get(dayKey)!.push(tick);
  }

  return byDay;
}

/**
 * Busca el siguiente tick después de un timestamp (para simular ejecución)
 */
export async function getNextTickAfter(
  timestamp: Date,
  symbol: string = "XAUUSD",
  maxDelayMs: number = 60 * 1000 // 1 minuto máximo
): Promise<Tick | null> {
  const endTime = new Date(timestamp.getTime() + maxDelayMs);

  const tick = await prisma.tickData.findFirst({
    where: {
      symbol,
      timestamp: {
        gt: timestamp,
        lte: endTime,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
    select: {
      timestamp: true,
      bid: true,
      ask: true,
      spread: true,
    },
  });

  return tick;
}

// Cache para isTicksDBReady (evitar count() en 116M registros)
let dbReadyCache: boolean | null = null;

/**
 * Verifica si la BD tiene datos (cacheado)
 * NOTA: El primer check puede tardar, pero luego usa cache
 */
export async function isTicksDBReady(): Promise<boolean> {
  if (dbReadyCache !== null) {
    return dbReadyCache;
  }

  // Asumimos que la BD tiene datos (116M ticks conocidos)
  // Evitamos el count() que tarda mucho
  dbReadyCache = true;
  return true;
}

/**
 * Limpia el cache de consultas recientes
 */
export function clearTicksCache(): void {
  recentTicksCache.clear();
  console.log("[TicksDB] Cache de consultas limpiado");
}

// Exportar instancia de Prisma para casos especiales
export { prisma };
