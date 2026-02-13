/**
 * Loader de ticks históricos reales desde MT5
 *
 * Formato del archivo (XAUUSD_2024.csv.gz):
 * timestamp,bid,ask,spread
 * 2024-01-01T00:00:00.123,2060.50000,2060.60000,0.10
 */

import { createGunzip } from "zlib";
import { createReadStream } from "fs";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import { TradingSignal } from "./signals-csv";

export interface RealTick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

// Cache de ticks cargados
let cachedTicks: RealTick[] | null = null;
let cacheYear: number | null = null;

/**
 * Carga ticks desde archivo gzip
 * Usa cache para evitar recargas innecesarias
 */
export async function loadTicksFromGzip(
  filePath: string,
  forceReload = false
): Promise<RealTick[]> {
  // Verificar cache
  if (cachedTicks && !forceReload) {
    return cachedTicks;
  }

  return new Promise((resolve, reject) => {
    const ticks: RealTick[] = [];
    let buffer = "";

    const fileStream = createReadStream(filePath);
    const gunzip = createGunzip();

    fileStream
      .pipe(gunzip)
      .on("data", (chunk: Buffer) => {
        buffer += chunk.toString();

        // Procesar líneas completas
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Mantener línea incompleta

        for (const line of lines) {
          const tick = parseTickLine(line);
          if (tick) {
            ticks.push(tick);
          }
        }
      })
      .on("end", () => {
        // Procesar última línea
        if (buffer.trim()) {
          const tick = parseTickLine(buffer);
          if (tick) {
            ticks.push(tick);
          }
        }

        // Ordenar por timestamp
        ticks.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Guardar en cache
        cachedTicks = ticks;

        console.log(`[TicksLoader] Cargados ${ticks.length} ticks desde ${filePath}`);
        resolve(ticks);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Parsea una línea del CSV de ticks
 */
function parseTickLine(line: string): RealTick | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("timestamp")) {
    return null; // Skip header o líneas vacías
  }

  const parts = trimmed.split(",");
  if (parts.length < 4) {
    return null;
  }

  const [timestampStr, bidStr, askStr, spreadStr] = parts;

  try {
    const timestamp = new Date(timestampStr);
    const bid = parseFloat(bidStr);
    const ask = parseFloat(askStr);
    const spread = parseFloat(spreadStr);

    if (isNaN(bid) || isNaN(ask)) {
      return null;
    }

    return { timestamp, bid, ask, spread };
  } catch {
    return null;
  }
}

/**
 * Obtiene ticks en un rango de fechas específico
 */
export async function getTicksInRange(
  startTime: Date,
  endTime: Date,
  dataDir: string = path.join(process.cwd(), "data", "ticks")
): Promise<RealTick[]> {
  // Determinar qué archivo(s) necesitamos basándonos en el año
  const startYear = startTime.getFullYear();
  const endYear = endTime.getFullYear();

  const allTicks: RealTick[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const filePath = path.join(dataDir, `XAUUSD_${year}.csv.gz`);

    if (!fs.existsSync(filePath)) {
      console.warn(`[TicksLoader] Archivo no encontrado: ${filePath}`);
      continue;
    }

    // Invalidar cache si cambió el año
    if (cacheYear !== year) {
      cachedTicks = null;
      cacheYear = year;
    }

    const ticks = await loadTicksFromGzip(filePath);

    // Filtrar por rango
    const filtered = ticks.filter(
      (t) => t.timestamp >= startTime && t.timestamp <= endTime
    );

    allTicks.push(...filtered);
  }

  return allTicks;
}

/**
 * Obtiene ticks para una señal específica
 * Busca desde el momento de la señal hasta su cierre (o un máximo de tiempo)
 */
export async function getTicksForSignal(
  signalTimestamp: Date,
  closeTimestamp?: Date,
  maxDurationMs: number = 24 * 60 * 60 * 1000 // 24 horas por defecto
): Promise<RealTick[]> {
  const endTime = closeTimestamp
    ? new Date(Math.min(closeTimestamp.getTime(), signalTimestamp.getTime() + maxDurationMs))
    : new Date(signalTimestamp.getTime() + maxDurationMs);

  return getTicksInRange(signalTimestamp, endTime);
}

/**
 * Comprueba si hay datos de ticks disponibles
 */
export function hasTicksData(dataDir: string = path.join(process.cwd(), "data", "ticks")): boolean {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".csv.gz"));
  return files.length > 0;
}

/**
 * Obtiene información sobre los datos de ticks disponibles
 */
export function getTicksInfo(dataDir: string = path.join(process.cwd(), "data", "ticks")): {
  files: string[];
  totalSizeMB: number;
} {
  if (!fs.existsSync(dataDir)) {
    return { files: [], totalSizeMB: 0 };
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".csv.gz"));
  let totalSize = 0;

  for (const file of files) {
    const stat = fs.statSync(path.join(dataDir, file));
    totalSize += stat.size;
  }

  return {
    files,
    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
  };
}

/**
 * Limpia el cache de ticks
 */
export function clearTicksCache(): void {
  cachedTicks = null;
  cacheYear = null;
}

/**
 * Obtiene el precio de mercado en un timestamp específico
 * Busca el tick más cercano al timestamp dado
 */
export async function getMarketPriceAt(
  timestamp: Date,
  dataDir: string = path.join(process.cwd(), "data", "ticks"),
  toleranceMs: number = 5 * 60 * 1000 // 5 minutos de tolerancia
): Promise<{ bid: number; ask: number; spread: number } | null> {
  const year = timestamp.getFullYear();
  const filePath = path.join(dataDir, `XAUUSD_${year}.csv.gz`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  // Invalidar cache si cambió el año
  if (cacheYear !== year) {
    cachedTicks = null;
    cacheYear = year;
  }

  const ticks = await loadTicksFromGzip(filePath);

  if (ticks.length === 0) {
    return null;
  }

  // Buscar el tick más cercano con búsqueda binaria
  const targetTime = timestamp.getTime();
  let left = 0;
  let right = ticks.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (ticks[mid].timestamp.getTime() < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Verificar ticks adyacentes para encontrar el más cercano
  let bestTick = ticks[left];
  let bestDiff = Math.abs(bestTick.timestamp.getTime() - targetTime);

  // Verificar tick anterior
  if (left > 0) {
    const prevDiff = Math.abs(ticks[left - 1].timestamp.getTime() - targetTime);
    if (prevDiff < bestDiff) {
      bestTick = ticks[left - 1];
      bestDiff = prevDiff;
    }
  }

  // Verificar tolerancia
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
 * Añade precios de entrada reales a las señales parseadas
 * Busca el precio de mercado en el momento de cada señal
 * Filtra las señales que no pueden ser enriquecidas si filterUnavailable=true
 */
export async function enrichSignalsWithRealPrices(
  signals: TradingSignal[],
  dataDir?: string,
  filterUnavailable: boolean = true
): Promise<TradingSignal[]> {
  const enrichedSignals: TradingSignal[] = [];
  let enriched = 0;
  let unavailable = 0;

  for (const signal of signals) {
    const marketPrice = await getMarketPriceAt(signal.timestamp, dataDir);

    if (marketPrice) {
      // Usar el precio medio entre bid y ask como precio de entrada
      const entryPrice = (marketPrice.bid + marketPrice.ask) / 2;

      enrichedSignals.push({
        ...signal,
        entryPrice,
        confidence: Math.min(signal.confidence + 0.05, 1.0), // Aumentar confianza
      });
      enriched++;
    } else {
      // No hay precio disponible para esta señal
      unavailable++;

      if (!filterUnavailable && signal.entryPrice > 0) {
        // Mantener señal original si ya tenía precio
        enrichedSignals.push(signal);
      }
      // Si filterUnavailable=true, se omite la señal
    }
  }

  console.log(`[TicksLoader] Enriquecidas: ${enriched}, Sin precio: ${unavailable}, Total: ${enrichedSignals.length}`);

  return enrichedSignals;
}
