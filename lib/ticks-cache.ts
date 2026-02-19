/**
 * Cache inteligente de ticks para optimizar el backtester
 *
 * ⚠️ DEPRECADO - Usar lib/ticks-db.ts en su lugar
 *
 * Este archivo se mantiene por compatibilidad pero NO debe usarse para nuevos desarrollos.
 * El nuevo sistema usa SQLite (ticks-db.ts) que:
 * - No consume memoria (los datos están en disco)
 * - Es más rápido para consultas por rango de fechas
 * - Escala mejor con múltiples usuarios
 *
 * ESTRATEGIA ORIGINAL: No cargar todos los ticks en memoria (son 80M+, usaría 4GB+)
 * En su lugar:
 * - Cargar índice de posiciones por día (ligero)
 * - Cargar ticks bajo demanda y cachearlos por día (LRU)
 * - Límite de memoria configurable
 */

import * as fs from "fs";
import * as path from "path";
import { createGunzip } from "zlib";
import { createReadStream } from "fs";

export interface CachedTick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

interface DayIndex {
  date: string; // "2024-01-15"
  file: string; // "XAUUSD_2024.csv.gz"
  startLine: number;
  endLine: number;
  firstTimestamp: Date;
  lastTimestamp: Date;
}

// Índice de días (ligero, pocos KB)
let dayIndex: DayIndex[] = [];
let indexLoaded = false;

// Cache de ticks por día
const ticksByDay = new Map<string, CachedTick[]>();
// Sin límite - cargamos todos los días en memoria al iniciar
// 492 días * ~2MB/día = ~1GB de RAM (aceptable para un servidor)

// Orden de acceso para LRU
const accessOrder: string[] = [];

// Estado
let isLoading = false;
let lastError: string | null = null;

// Configuración
const TICKS_DIR = path.join(process.cwd(), "data", "ticks");
const INDEX_FILE = path.join(process.cwd(), "data", "ticks-index.json");

/**
 * Construye el índice de días - primero intenta cargar desde archivo pre-generado
 */
export async function initializeTicksCache(): Promise<void> {
  if (indexLoaded || isLoading) {
    console.log(`[TicksCache] Ya inicializado (loaded: ${indexLoaded}, loading: ${isLoading})`);
    return;
  }

  isLoading = true;
  lastError = null;
  console.log("[TicksCache] Inicializando...");
  const startTime = Date.now();

  try {
    // Intentar cargar índice pre-generado
    if (fs.existsSync(INDEX_FILE)) {
      console.log(`[TicksCache] Cargando índice desde ${INDEX_FILE}...`);
      const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));

      // Convertir timestamps de string a Date
      dayIndex = indexData.days.map((d: any) => ({
        ...d,
        firstTimestamp: new Date(d.firstTimestamp),
        lastTimestamp: new Date(d.lastTimestamp),
      }));

      indexLoaded = true;
      const elapsed = Date.now() - startTime;
      console.log(`[TicksCache] Índice cargado desde archivo: ${dayIndex.length} días en ${elapsed}ms`);
      return;
    }

    // Si no hay archivo, construir índice (lento)
    console.log("[TicksCache] No hay índice pre-generado, construyendo...");
    console.log(`[TicksCache] Buscando ticks en: ${TICKS_DIR}`);

    if (!fs.existsSync(TICKS_DIR)) {
      const errorMsg = `Directorio de ticks no encontrado: ${TICKS_DIR}`;
      console.error("[TicksCache] " + errorMsg);
      lastError = errorMsg;
      indexLoaded = true;
      return;
    }

    const files = fs.readdirSync(TICKS_DIR)
      .filter(f => f.endsWith(".csv.gz"))
      .sort();

    console.log(`[TicksCache] Encontrados ${files.length} archivos .csv.gz`);

    if (files.length === 0) {
      const errorMsg = "No hay archivos de ticks .csv.gz";
      console.error("[TicksCache] " + errorMsg);
      lastError = errorMsg;
      indexLoaded = true;
      return;
    }

    // Construir índice recorriendo archivos una vez
    dayIndex = [];

    for (const file of files) {
      const filePath = path.join(TICKS_DIR, file);
      console.log(`[TicksCache] Procesando ${file}...`);
      const dayIndices = await buildDayIndexForFile(filePath, file);
      dayIndex.push(...dayIndices);
      console.log(`[TicksCache] Índice de ${file}: ${dayIndices.length} días`);
    }

    indexLoaded = true;
    const elapsed = Date.now() - startTime;
    console.log(`[TicksCache] Índice construido: ${dayIndex.length} días en ${elapsed}ms`);

  } catch (error) {
    lastError = error instanceof Error ? error.message : "Unknown error";
    console.error("[TicksCache] Error construyendo índice:", error);
  } finally {
    isLoading = false;
  }
}

/**
 * Construye el índice de días para un archivo
 */
async function buildDayIndexForFile(filePath: string, filename: string): Promise<DayIndex[]> {
  return new Promise((resolve, reject) => {
    const indices: DayIndex[] = [];
    let buffer = "";
    let lineNum = 0;
    let currentDay: DayIndex | null = null;

    const fileStream = createReadStream(filePath);
    const gunzip = createGunzip();

    fileStream
      .pipe(gunzip)
      .on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const tick = parseTickLine(line);
          if (tick) {
            const dateKey = tick.timestamp.toISOString().slice(0, 10);

            if (!currentDay || currentDay.date !== dateKey) {
              // Guardar día anterior
              if (currentDay) {
                currentDay.endLine = lineNum - 1;
                indices.push(currentDay);
              }
              // Nuevo día
              currentDay = {
                date: dateKey,
                file: filename,
                startLine: lineNum,
                endLine: lineNum,
                firstTimestamp: tick.timestamp,
                lastTimestamp: tick.timestamp,
              };
            } else {
              currentDay.lastTimestamp = tick.timestamp;
            }
          }
          lineNum++;
        }
      })
      .on("end", () => {
        // Guardar último día
        if (currentDay) {
          currentDay.endLine = lineNum - 1;
          indices.push(currentDay);
        }
        resolve(indices);
      })
      .on("error", reject);
  });
}

/**
 * Parsea una línea del CSV de ticks
 */
function parseTickLine(line: string): CachedTick | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("timestamp")) {
    return null;
  }

  const parts = trimmed.split(",");
  if (parts.length < 4) {
    return null;
  }

  try {
    const timestamp = new Date(parts[0]);
    const bid = parseFloat(parts[1]);
    const ask = parseFloat(parts[2]);
    const spread = parseFloat(parts[3]);

    if (isNaN(bid) || isNaN(ask)) {
      return null;
    }

    return { timestamp, bid, ask, spread };
  } catch {
    return null;
  }
}

/**
 * Obtiene el estado del cache
 */
export function getCacheStatus(): {
  isLoaded: boolean;
  isLoading: boolean;
  totalTicks: number;
  totalDays: number;
  memoryMB: number;
  cachedDays: number;
  error?: string;
} {
  // Estimar memoria de ticks cacheados
  let totalTicks = 0;
  for (const ticks of ticksByDay.values()) {
    totalTicks += ticks.length;
  }
  const memoryMB = Math.round(totalTicks * 48 / 1024 / 1024 * 100) / 100;

  return {
    isLoaded: indexLoaded,
    isLoading,
    totalTicks,
    totalDays: dayIndex.length,
    memoryMB,
    cachedDays: ticksByDay.size,
    error: lastError || undefined,
  };
}

/**
 * Obtiene ticks para un día específico (con cache)
 */
async function getTicksForDay(dateKey: string): Promise<CachedTick[]> {
  // Verificar cache
  if (ticksByDay.has(dateKey)) {
    return ticksByDay.get(dateKey)!;
  }

  // Buscar en índice
  const dayInfo = dayIndex.find(d => d.date === dateKey);
  if (!dayInfo) {
    return [];
  }

  // Cargar ticks del día
  const filePath = path.join(TICKS_DIR, dayInfo.file);
  const ticks = await loadTicksForDay(filePath, dayInfo);

  // Guardar en cache (sin límite)
  ticksByDay.set(dateKey, ticks);

  console.log(`[TicksCache] Cargados ${ticks.length} ticks para ${dateKey} (cache: ${ticksByDay.size} días)`);

  return ticks;
}

/**
 * Carga ticks para un día específico desde el archivo
 */
async function loadTicksForDay(filePath: string, dayInfo: DayIndex): Promise<CachedTick[]> {
  return new Promise((resolve, reject) => {
    const ticks: CachedTick[] = [];
    let buffer = "";
    let lineNum = 0;
    let collecting = false;

    const fileStream = createReadStream(filePath);
    const gunzip = createGunzip();

    fileStream
      .pipe(gunzip)
      .on("data", (chunk: Buffer) => {
        if (ticks.length > 0 && ticks.length % 100000 === 0) {
          console.log(`[TicksCache] Cargados ${ticks.length} ticks...`);
        }

        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          // Verificar si estamos en el rango
          if (lineNum >= dayInfo.startLine && lineNum <= dayInfo.endLine) {
            const tick = parseTickLine(line);
            if (tick) {
              ticks.push(tick);
            }
          }
          lineNum++;

          // Salir si pasamos el rango
          if (lineNum > dayInfo.endLine) {
            fileStream.destroy();
            resolve(ticks);
            return;
          }
        }
      })
      .on("end", () => {
        resolve(ticks);
      })
      .on("error", reject);
  });
}

/**
 * Obtiene ticks en un rango de fechas (bajo demanda)
 */
export async function getTicksFromCache(startTime: Date, endTime: Date): Promise<CachedTick[]> {
  if (!indexLoaded) {
    await initializeTicksCache();
  }

  if (dayIndex.length === 0) {
    return [];
  }

  const startDateKey = startTime.toISOString().slice(0, 10);
  const endDateKey = endTime.toISOString().slice(0, 10);

  // Encontrar días en el rango
  const daysInRange = dayIndex.filter(d => d.date >= startDateKey && d.date <= endDateKey);

  if (daysInRange.length === 0) {
    return [];
  }

  // Limitar a máximo 7 días para evitar sobrecarga
  const daysToLoad = daysInRange.slice(0, 7);

  // Cargar ticks de cada día
  const allTicks: CachedTick[] = [];

  for (const day of daysToLoad) {
    const dayTicks = await getTicksForDay(day.date);

    // Filtrar por rango de tiempo exacto
    const filtered = dayTicks.filter(t =>
      t.timestamp >= startTime && t.timestamp <= endTime
    );

    allTicks.push(...filtered);
  }

  return allTicks;
}

/**
 * Obtiene el precio de mercado en un timestamp específico
 */
export async function getMarketPriceFromCache(
  timestamp: Date,
  toleranceMs: number = 5 * 60 * 1000
): Promise<{ bid: number; ask: number; spread: number } | null> {
  const dateKey = timestamp.toISOString().slice(0, 10);

  // Buscar un rango amplio para encontrar el tick más cercano
  const startTime = new Date(timestamp.getTime() - toleranceMs);
  const endTime = new Date(timestamp.getTime() + toleranceMs);

  const ticks = await getTicksFromCache(startTime, endTime);

  if (ticks.length === 0) {
    return null;
  }

  // Encontrar el más cercano
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

// Versiones síncronas para compatibilidad (retornan vacío si no está cacheado)
export function getTicksFromCacheSync(startTime: Date, endTime: Date): CachedTick[] {
  if (!indexLoaded || ticksByDay.size === 0) {
    return [];
  }

  const startDateKey = startTime.toISOString().slice(0, 10);
  const endDateKey = endTime.toISOString().slice(0, 10);

  const allTicks: CachedTick[] = [];

  for (const [dateKey, ticks] of ticksByDay) {
    if (dateKey >= startDateKey && dateKey <= endDateKey) {
      const filtered = ticks.filter(t =>
        t.timestamp >= startTime && t.timestamp <= endTime
      );
      allTicks.push(...filtered);
    }
  }

  return allTicks;
}

export function getMarketPriceFromCacheSync(
  timestamp: Date,
  toleranceMs: number = 5 * 60 * 1000
): { bid: number; ask: number; spread: number } | null {
  const dateKey = timestamp.toISOString().slice(0, 10);
  const ticks = ticksByDay.get(dateKey);

  if (!ticks || ticks.length === 0) {
    return null;
  }

  const targetTime = timestamp.getTime();
  let bestTick = ticks[0];
  let bestDiff = Math.abs(ticks[0].timestamp.getTime() - targetTime);

  for (const tick of ticks) {
    const diff = Math.abs(tick.timestamp.getTime() - targetTime);
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
 * Limpia el cache de ticks (mantiene índice)
 */
export function clearCache(): void {
  ticksByDay.clear();
  accessOrder.length = 0;
  console.log("[TicksCache] Cache de ticks limpiado");
}

/**
 * Verifica si el índice está listo
 */
export function isCacheReady(): boolean {
  return indexLoaded;
}

/**
 * Espera a que el índice esté listo
 */
export async function waitForCache(): Promise<void> {
  if (indexLoaded) {
    return;
  }
  return initializeTicksCache();
}

/**
 * Precarga los días necesarios para un conjunto de señales
 * Esto hace que el primer backtest sea rápido
 */
export async function preloadDaysForSignals(signals: { timestamp: Date; closeTimestamp?: Date }[]): Promise<void> {
  if (!indexLoaded) {
    await initializeTicksCache();
  }

  // Obtener días únicos necesarios
  const daysNeeded = new Set<string>();

  for (const signal of signals) {
    const startKey = signal.timestamp.toISOString().slice(0, 10);
    const endKey = (signal.closeTimestamp || new Date(signal.timestamp.getTime() + 8 * 60 * 60 * 1000))
      .toISOString().slice(0, 10);

    // Añadir todos los días en el rango
    const start = new Date(startKey);
    const end = new Date(endKey);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      daysNeeded.add(d.toISOString().slice(0, 10));
    }
  }

  console.log(`[TicksCache] Precargando ${daysNeeded.size} días para ${signals.length} señales...`);

  const startTime = Date.now();
  let loaded = 0;

  // Cargar cada día (con límite de concurrencia)
  const daysArray = Array.from(daysNeeded);

  for (const day of daysArray) {
    try {
      await getTicksForDay(day);
      loaded++;

      if (loaded % 10 === 0) {
        const elapsed = Date.now() - startTime;
        const rate = loaded / (elapsed / 1000);
        const remaining = (daysArray.length - loaded) / rate;
        console.log(`[TicksCache] Precargados ${loaded}/${daysArray.length} días (~${Math.round(remaining)}s restantes)`);
      }
    } catch (error) {
      console.warn(`[TicksCache] Error precargando ${day}:`, error);
    }
  }

  const elapsed = Date.now() - startTime;
  const status = getCacheStatus();
  console.log(`[TicksCache] Precarga completada: ${loaded} días, ${status.totalTicks} ticks, ${status.memoryMB}MB en ${elapsed}ms`);
}

/**
 * Precarga TODOS los días del índice en memoria
 * Esto hace que todos los backtests sean instantáneos
 * Tarda 5-10 minutos pero solo se ejecuta una vez al iniciar el servidor
 *
 * ⚠️ DEPRECATED: Esta función causa OOM con muchos ticks.
 * Usar SQLite (ticks-db.ts) en su lugar.
 */
export async function preloadAllTicks(): Promise<void> {
  // DESACTIVADO - Causa Out of Memory con ~40M ticks
  // Usar SQLite (lib/ticks-db.ts) en su lugar
  console.warn("[TicksCache] ⚠️ preloadAllTicks() está DEPRECADO y desactivado.");
  console.warn("[TicksCache] Usar SQLite (lib/ticks-db.ts) para backtests eficientes.");
  return;
  if (!indexLoaded) {
    await initializeTicksCache();
  }

  if (dayIndex.length === 0) {
    console.warn("[TicksCache] No hay días para precargar");
    return;
  }

  // Verificar si ya están todos cargados
  if (ticksByDay.size >= dayIndex.length) {
    console.log(`[TicksCache] Todos los días ya están en cache (${ticksByDay.size} días)`);
    return;
  }

  console.log(`[TicksCache] ===== PRECARGANDO TODOS LOS TICKS EN MEMORIA =====`);
  console.log(`[TicksCache] Total días a cargar: ${dayIndex.length}`);
  console.log(`[TicksCache] Esto tardará 5-10 minutos. Por favor espere...`);

  const startTime = Date.now();
  let loaded = 0;
  let errors = 0;

  // Cargar cada día
  for (const dayInfo of dayIndex) {
    try {
      // Verificar si ya está cargado
      if (ticksByDay.has(dayInfo.date)) {
        loaded++;
        continue;
      }

      const filePath = path.join(TICKS_DIR, dayInfo.file);
      const ticks = await loadTicksForDay(filePath, dayInfo);

      ticksByDay.set(dayInfo.date, ticks);
      loaded++;

      // Log cada 20 días
      if (loaded % 20 === 0) {
        const elapsed = Date.now() - startTime;
        const rate = loaded / (elapsed / 1000);
        const remaining = (dayIndex.length - loaded) / rate;
        const status = getCacheStatus();
        console.log(`[TicksCache] Progreso: ${loaded}/${dayIndex.length} días | ${status.totalTicks} ticks | ${status.memoryMB}MB | ~${Math.round(remaining)}s restantes`);
      }
    } catch (error) {
      errors++;
      console.warn(`[TicksCache] Error cargando ${dayInfo.date}:`, error);
    }
  }

  const elapsed = Date.now() - startTime;
  const status = getCacheStatus();
  console.log(`[TicksCache] ===== PRECARGA COMPLETADA =====`);
  console.log(`[TicksCache] Días cargados: ${loaded}/${dayIndex.length} (${errors} errores)`);
  console.log(`[TicksCache] Total ticks: ${status.totalTicks}`);
  console.log(`[TicksCache] Memoria usada: ${status.memoryMB}MB`);
  console.log(`[TicksCache] Tiempo total: ${Math.round(elapsed / 1000)}s`);
}
