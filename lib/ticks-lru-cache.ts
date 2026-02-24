/**
 * Ticks LRU Cache - Cache con limite de memoria para ticks
 *
 * PROBLEMA: El cache global sin limite causaba OOM con muchos dias
 * SOLUCION: LRU (Least Recently Used) con limite de memoria configurable
 *
 * Caracteristicas:
 * - Limite de memoria configurable (default: 100MB)
 * - Auto-eviccion de entradas antiguas cuando se llena
 * - Estadisticas de uso para monitoreo
 */

interface CacheEntry {
  ticks: Array<{
    timestamp: Date;
    bid: number;
    ask: number;
    spread: number;
  }>;
  lastAccess: number;
  sizeBytes: number;
}

interface CacheStats {
  entries: number;
  totalTicks: number;
  currentSizeMB: number;
  maxSizeMB: number;
  hits: number;
  misses: number;
  evictions: number;
}

export class TicksLRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSizeBytes: number;
  private currentSizeBytes = 0;

  // Estadisticas
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  // Tamano estimado por tick en bytes
  private static TICK_SIZE_BYTES = 80; // Date(8) + 3 * number(24) + overhead

  constructor(maxSizeMB: number = 100) {
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
    console.log(`[LRUCache] Inicializado con limite de ${maxSizeMB}MB`);
  }

  /**
   * Obtiene ticks de un dia del cache
   * Actualiza lastAccess para LRU
   */
  get(dayKey: string): Array<{ timestamp: Date; bid: number; ask: number; spread: number }> | null {
    const entry = this.cache.get(dayKey);

    if (entry) {
      // Hit - actualizar lastAccess
      entry.lastAccess = Date.now();
      this.hits++;

      // Mover al final para LRU (Map mantiene orden de insercion)
      this.cache.delete(dayKey);
      this.cache.set(dayKey, entry);

      return entry.ticks;
    }

    // Miss
    this.misses++;
    return null;
  }

  /**
   * Almacena ticks de un dia en el cache
   * Evicta entradas antiguas si es necesario
   */
  set(dayKey: string, ticks: Array<{ timestamp: Date; bid: number; ask: number; spread: number }>): void {
    // Calcular tamano
    const sizeBytes = ticks.length * TicksLRUCache.TICK_SIZE_BYTES;

    // Si la entrada ya existe, restar su tamano actual
    const existing = this.cache.get(dayKey);
    if (existing) {
      this.currentSizeBytes -= existing.sizeBytes;
    }

    // Verificar si necesitamos evictar
    while (this.currentSizeBytes + sizeBytes > this.maxSizeBytes && this.cache.size > 0) {
      this.evictOldest();
    }

    // Almacenar
    const entry: CacheEntry = {
      ticks,
      lastAccess: Date.now(),
      sizeBytes,
    };

    this.cache.set(dayKey, entry);
    this.currentSizeBytes += sizeBytes;
  }

  /**
   * Verifica si un dia esta en cache
   */
  has(dayKey: string): boolean {
    return this.cache.has(dayKey);
  }

  /**
   * Evicta la entrada mas antigua (LRU)
   */
  private evictOldest(): void {
    // Map mantiene orden de insercion, el primero es el mas antiguo
    const oldestKey = this.cache.keys().next().value;

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentSizeBytes -= entry.sizeBytes;
      }
      this.cache.delete(oldestKey);
      this.evictions++;

      if (this.evictions % 10 === 0) {
        console.log(`[LRUCache] Evicciones: ${this.evictions}, Memoria: ${(this.currentSizeBytes / 1024 / 1024).toFixed(1)}MB`);
      }
    }
  }

  /**
   * Limpia el cache completamente
   */
  clear(): void {
    const stats = this.getStats();
    console.log(`[LRUCache] Limpiando cache: ${stats.entries} dias, ${stats.currentSizeMB}MB`);

    this.cache.clear();
    this.currentSizeBytes = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Obtiene estadisticas del cache
   */
  getStats(): CacheStats {
    let totalTicks = 0;
    for (const entry of this.cache.values()) {
      totalTicks += entry.ticks.length;
    }

    return {
      entries: this.cache.size,
      totalTicks,
      currentSizeMB: Math.round(this.currentSizeBytes / 1024 / 1024 * 100) / 100,
      maxSizeMB: Math.round(this.maxSizeBytes / 1024 / 1024 * 100) / 100,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  /**
   * Obtiene las claves de dias en cache (para debug)
   */
  getDaysInCache(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Fuerza garbage collection de entradas antiguas (opcional)
   * @param maxAgeMs - Edad maxima en milisegundos (default: 30 min)
   */
  pruneOldEntries(maxAgeMs: number = 30 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < cutoff) {
        this.currentSizeBytes -= entry.sizeBytes;
        this.cache.delete(key);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`[LRUCache] Podadas ${pruned} entradas antiguas`);
    }

    return pruned;
  }
}

// Instancia global con limite de 500MB para backtests completos
export const ticksLRUCache = new TicksLRUCache(500);
