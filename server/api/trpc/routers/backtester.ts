/**
 * Router tRPC del Backtester (SQLITE VERSION)
 *
 * Arquitectura optimizada:
 * - Ticks almacenados en SQLite (no en memoria)
 * - Consultas rápidas con índices
 * - Bajo uso de memoria (~50MB vs ~1GB)
 * - Escala con múltiples usuarios
 */

import { z } from "zod";
import { procedure, router } from "../init";
import {
  BacktestEngine,
  BacktestConfig,
  BacktestResult,
  Side,
} from "@/lib/backtest-engine";
import {
  loadSignalsFromFile,
  generateSyntheticTicks,
  TradingSignal,
} from "@/lib/parsers/signals-csv";
import {
  getTicksForSignal,
  hasTicksData,
  getTicksInfo,
} from "@/lib/parsers/ticks-loader";
import {
  getTicksFromDB,
  getMarketPrice,
  getTicksStats,
  isTicksDBReady,
  getTicksByDays,
  clearTicksCache,
} from "@/lib/ticks-db";
import {
  getCachedResult,
  cacheResult,
  hashConfig,
  clearBacktestCache,
  getCacheStats,
} from "@/lib/backtest-cache";
import {
  createJob,
  getJob,
  getActiveJobs,
  getQueuedJobs,
  getCompletedJobs,
  cancelJob,
  getJobsStats,
  type BacktestJob,
} from "@/lib/backtest-jobs";
import {
  filterSignals,
  getSegmentationStats,
} from "@/lib/backtest-filters";
import path from "path";

// ==================== SCHEMAS ====================

const BacktestFiltersSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  hourFrom: z.number().min(0).max(23).optional(),
  hourTo: z.number().min(0).max(24).optional(),
  session: z.enum(["ASIAN", "EUROPEAN", "US", "ALL"]).optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
}).optional();

const BacktestConfigSchema = z.object({
  strategyName: z.string().default("Toni (G4)"),
  lotajeBase: z.number().min(0.01).max(10).default(0.1),
  numOrders: z.number().min(1).max(5).default(1),
  pipsDistance: z.number().min(1).max(100).default(10),
  maxLevels: z.number().min(1).max(40).default(4),
  takeProfitPips: z.number().min(5).max(100).default(20),
  stopLossPips: z.number().min(0).max(500).optional(),
  useStopLoss: z.boolean().default(false),
  // Trailing SL Virtual
  useTrailingSL: z.boolean().optional().default(true),
  trailingSLPercent: z.number().min(10).max(90).optional().default(50),
  restrictionType: z.enum(["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"]).optional(),
  // Fuente de señales
  signalsSource: z.string().optional().default("signals_simple.csv"),
  useRealPrices: z.boolean().optional().default(true), // Habilitado para tests con pocas señales
  // Capital inicial
  initialCapital: z.number().min(100).max(10000000).optional().default(10000),
  // Filtros
  filters: BacktestFiltersSchema,
});

// ==================== HELPERS ====================

/**
 * Genera ticks sintéticos para una señal (fallback)
 */
function generateSyntheticTicksForSignal(
  signal: TradingSignal,
  config: { takeProfitPips: number; pipsDistance: number }
): { timestamp: Date; bid: number; ask: number; spread: number }[] {
  const durationMs = signal.closeTimestamp
    ? signal.closeTimestamp.getTime() - signal.timestamp.getTime()
    : 30 * 60 * 1000;

  const exitPrice =
    signal.side === "BUY"
      ? signal.entryPrice + config.takeProfitPips * 0.1
      : signal.entryPrice - config.takeProfitPips * 0.1;

  return generateSyntheticTicks(
    signal.entryPrice,
    exitPrice,
    durationMs,
    config.pipsDistance * 2
  );
}

// ==================== ROUTER ====================

export const backtesterRouter = router({
  /**
   * Ejecuta un backtest síncrono (rápido, para pocas señales)
   * Usa SQLite para ticks y cache de resultados
   */
  execute: procedure
    .input(
      z.object({
        config: BacktestConfigSchema,
        signalLimit: z.number().min(1).max(10000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const jobId = `backtest_${Date.now()}`;
      const startTime = Date.now();

      try {
        // Verificar cache de resultados primero
        const signalsSource = input.config.signalsSource || "signals_simple.csv";
        const cachedResult = getCachedResult(input.config as BacktestConfig, signalsSource);

        if (cachedResult) {
          console.log(`[Backtester] Resultado desde cache: ${hashConfig(input.config as BacktestConfig, signalsSource)}`);
          return {
            jobId,
            status: "completed",
            results: cachedResult,
            fromCache: true,
            elapsedMs: Date.now() - startTime,
          };
        }

        // Verificar si SQLite tiene ticks
        const dbReady = await isTicksDBReady();
        const wantsRealPrices = input.config.useRealPrices === true;

        // Cargar señales
        const signalsPath = path.join(process.cwd(), signalsSource);
        let signals = await loadSignalsFromFile(signalsPath);

        // Aplicar filtros
        if (input.config.filters) {
          const beforeFilter = signals.length;
          signals = filterSignals(signals, input.config.filters as any);
          console.log(`[Backtester] Filtros aplicados: ${beforeFilter} -> ${signals.length} señales`);
        }

        if (input.signalLimit) {
          signals = signals.slice(0, input.signalLimit);
        }

        // Enriquecer con precios de SQLite si está disponible
        if (wantsRealPrices && dbReady) {
          const enrichedSignals: TradingSignal[] = [];

          for (const signal of signals) {
            const marketPrice = await getMarketPrice(signal.timestamp);

            if (marketPrice) {
              const entryPrice = (marketPrice.bid + marketPrice.ask) / 2;
              enrichedSignals.push({
                ...signal,
                entryPrice,
              });
            } else if (signal.entryPrice > 0) {
              enrichedSignals.push(signal);
            }
          }

          if (enrichedSignals.length > 0) {
            signals = enrichedSignals;
            console.log(`[Backtester] Enriquecidas ${enrichedSignals.length}/${signals.length} señales con precios reales`);
          }
        }

        // Crear motor
        const engine = new BacktestEngine(input.config as BacktestConfig);

        // Procesar cada señal
        for (let i = 0; i < signals.length; i++) {
          const signal = signals[i];

          engine.startSignal(signal.side, signal.entryPrice, i, signal.timestamp);

          // Obtener primer tick para el timestamp de entrada
          let entryTimestamp = signal.timestamp;
          if (wantsRealPrices && dbReady) {
            const firstTick = await getMarketPrice(signal.timestamp, "XAUUSD", 5 * 60 * 1000);
            if (firstTick) {
              // Usar el timestamp del tick más cercano
            }
          }

          engine.openInitialOrders(signal.entryPrice, entryTimestamp);

          // Obtener ticks desde SQLite o generar sintéticos
          let ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];

          if (wantsRealPrices && dbReady) {
            const endTime = signal.closeTimestamp
              ? new Date(Math.min(signal.closeTimestamp.getTime(), signal.timestamp.getTime() + 24 * 60 * 60 * 1000))
              : new Date(signal.timestamp.getTime() + 24 * 60 * 60 * 1000);

            ticks = await getTicksFromDB(signal.timestamp, endTime);
          }

          // Si no hay ticks reales, usar sintéticos
          if (ticks.length === 0 || input.config.useRealPrices === false) {
            ticks = generateSyntheticTicksForSignal(signal, input.config);
          }

          for (const tick of ticks) {
            engine.processTick(tick);
          }
        }

        const results = engine.getResults();

        // Calcular estadísticas de segmentación
        const profits = results.tradeDetails.map(d => d.totalProfit);
        const segmentation = getSegmentationStats(
          signals.filter((_, i) => i < results.tradeDetails.length),
          profits
        );

        // Guardar en cache
        cacheResult(input.config as BacktestConfig, signalsSource, results);

        const elapsedMs = Date.now() - startTime;
        console.log(`[Backtester] Backtest completado en ${elapsedMs}ms`);

        return {
          jobId,
          status: "completed",
          results: {
            ...results,
            segmentation,
          },
          fromCache: false,
          elapsedMs,
        };
      } catch (error) {
        console.error(`[Backtester] Error:`, error);
        throw error;
      }
    }),

  /**
   * Crea un job de backtest asíncrono (para muchas señales)
   */
  executeAsync: procedure
    .input(
      z.object({
        config: BacktestConfigSchema,
        signalLimit: z.number().min(1).max(10000).optional(),
        priority: z.number().min(0).max(10).default(0),
      })
    )
    .mutation(async ({ input }) => {
      const signalsSource = input.config.signalsSource || "signals_simple.csv";

      // Verificar cache primero
      const cachedResult = getCachedResult(input.config as BacktestConfig, signalsSource);

      if (cachedResult) {
        return {
          jobId: `cached_${Date.now()}`,
          status: "completed" as const,
          results: cachedResult,
          fromCache: true,
        };
      }

      // Crear job
      const job = createJob(
        input.config as BacktestConfig,
        signalsSource,
        input.signalLimit,
        input.priority
      );

      return {
        jobId: job.id,
        status: job.status,
        message: "Job creado y en cola",
      };
    }),

  /**
   * Obtiene el estado de un job
   */
  getJobStatus: procedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = getJob(input.jobId);

      if (!job) {
        throw new Error("Job not found");
      }

      return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        currentSignal: job.currentSignal,
        totalSignals: job.totalSignals,
        error: job.error,
        results: job.status === "completed" ? job.results : undefined,
      };
    }),

  /**
   * Cancela un job
   */
  cancelJob: procedure
    .input(z.object({ jobId: z.string() }))
    .mutation(({ input }) => {
      const success = cancelJob(input.jobId);

      if (!success) {
        throw new Error("Job not found or cannot be cancelled");
      }

      return { success: true };
    }),

  /**
   * Obtiene todos los jobs (activos, en cola, completados)
   */
  getAllJobs: procedure.query(() => {
    return {
      active: getActiveJobs(),
      queued: getQueuedJobs(),
      completed: getCompletedJobs().slice(0, 10), // Últimos 10
      stats: getJobsStats(),
    };
  }),

  /**
   * Obtiene el estado de la base de datos de ticks (SQLite)
   */
  getCacheStatus: procedure.query(async () => {
    const stats = await getTicksStats();
    return {
      isLoaded: stats.totalTicks > 0,
      isLoading: false,
      totalTicks: stats.totalTicks,
      totalDays: 0, // No aplicable con SQLite
      memoryMB: 50, // Aproximado, Prisma client
      cachedDays: 0,
      dbReady: stats.totalTicks > 0,
      firstTick: stats.firstTick,
      lastTick: stats.lastTick,
      estimatedSizeMB: stats.estimatedSizeMB,
    };
  }),

  /**
   * Verifica si la BD de ticks está lista
   */
  initCache: procedure.mutation(async () => {
    const ready = await isTicksDBReady();
    const stats = await getTicksStats();
    return {
      isLoaded: ready,
      totalTicks: stats.totalTicks,
      firstTick: stats.firstTick,
      lastTick: stats.lastTick,
    };
  }),

  /**
   * Precarga ticks (no-op con SQLite - ya están en disco)
   */
  preloadTicks: procedure
    .input(z.object({
      signalsSource: z.string().optional().default("signals_intradia.csv"),
    }))
    .mutation(async ({ input }) => {
      // Con SQLite, no necesitamos precargar nada
      // Los datos ya están en disco
      const stats = await getTicksStats();

      return {
        success: true,
        message: "SQLite no requiere precarga - los datos ya están en disco",
        dbStats: stats,
      };
    }),

  /**
   * Obtiene información de las señales disponibles
   */
  getSignalsInfo: procedure
    .input(z.object({
      source: z.string().optional().default("signals_simple.csv"),
    }))
    .query(async ({ input }) => {
      const signalsPath = path.join(process.cwd(), input.source);
      const signals = await loadSignalsFromFile(signalsPath);

      return {
        total: signals.length,
        source: input.source,
        dateRange: {
          start: signals[0]?.timestamp,
          end: signals[signals.length - 1]?.timestamp,
        },
        bySide: {
          buy: signals.filter((s) => s.side === "BUY").length,
          sell: signals.filter((s) => s.side === "SELL").length,
        },
      };
    }),

  /**
   * Obtiene información sobre los datos de ticks disponibles
   */
  getTicksInfo: procedure.query(async () => {
    const hasRealTicks = await isTicksDBReady();
    const stats = await getTicksStats();
    const fileSystemInfo = getTicksInfo();

    return {
      hasRealTicks,
      dbStats: stats,
      files: fileSystemInfo.files,
      totalSizeMB: fileSystemInfo.totalSizeMB,
    };
  }),

  /**
   * Lista las fuentes de señales disponibles
   */
  listSignalSources: procedure.query(async () => {
    const fs = await import("fs");
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);

    const signalFiles = files.filter(f =>
      f.startsWith("signals") && f.endsWith(".csv")
    );

    const sources = [];

    for (const file of signalFiles) {
      try {
        const signalsPath = path.join(cwd, file);
        const signals = await loadSignalsFromFile(signalsPath);

        sources.push({
          file,
          total: signals.length,
          dateRange: {
            start: signals[0]?.timestamp,
            end: signals[signals.length - 1]?.timestamp,
          },
        });
      } catch (error) {
        console.warn(`Error leyendo ${file}:`, error);
      }
    }

    return sources;
  }),

  /**
   * Migración: Importa ticks desde .gz a SQLite
   * Este endpoint permite disparar la migración desde la UI
   */
  importTicks: procedure.mutation(async () => {
    // Esta operación se hace con el script migrate-ticks-to-sqlite.ts
    // Aquí solo devolvemos instrucciones
    return {
      success: false,
      message: "Ejecuta el script de migración desde terminal:",
      command: "npx tsx scripts/migrate-ticks-to-sqlite.ts",
    };
  }),

  /**
   * Limpia el cache de resultados de backtest
   */
  clearCache: procedure.mutation(() => {
    clearBacktestCache();
    return {
      success: true,
      message: "Cache de backtest limpiado",
    };
  }),

  /**
   * Obtiene estadísticas del cache
   */
  getBacktestCacheStats: procedure.query(() => {
    return getCacheStats();
  }),

  /**
   * Ejecuta optimización de parámetros
   */
  optimize: procedure
    .input(
      z.object({
        params: z.object({
          pipsDistanceRange: z.array(z.number()).optional(),
          maxLevelsRange: z.array(z.number()).optional(),
          takeProfitRange: z.array(z.number()).optional(),
          trailingSLPercentRange: z.array(z.number()).optional(),
          lotajeBase: z.number().optional(),
          numOrders: z.number().optional(),
          useStopLoss: z.boolean().optional(),
          stopLossPips: z.number().optional(),
          useTrailingSL: z.boolean().optional(),
          restrictionType: z.enum(["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"]).optional(),
          initialCapital: z.number().optional(),
        }),
        options: z.object({
          signalsSource: z.string().default("signals_simple.csv"),
          signalLimit: z.number().optional(),
          metric: z.enum([
            "totalProfit",
            "winRate",
            "profitFactor",
            "sharpeRatio",
            "calmarRatio",
            "expectancy",
            "minDrawdown"
          ]).optional(),
          maxDrawdownPercent: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const { runOptimization } = await import("@/lib/optimizer");

      const results = await runOptimization(input.params, {
        ...input.options,
        onProgress: (progress) => {
          console.log(`[Optimizer] ${progress.current}/${progress.total} - Best: ${progress.bestSoFar?.score.toFixed(2)}`);
        },
      });

      return {
        totalCombinations: results.length,
        topResults: results.slice(0, 20), // Top 20
        best: results[0] || null,
      };
    }),

  /**
   * Obtiene presets de optimización rápida
   */
  getOptimizationPresets: procedure.query(async () => {
    const { getQuickOptimizationPresets, generateCombinations } = await import("@/lib/optimizer");

    const presets = getQuickOptimizationPresets();

    return presets.map((preset, i) => ({
      id: i,
      name: ["Conservador", "Balanceado", "Agresivo"][i] || `Preset ${i + 1}`,
      params: preset,
      combinations: generateCombinations(preset).length,
    }));
  }),

  /**
   * Obtiene los ticks para un trade específico (para el gráfico)
   */
  getTradeTicks: procedure
    .input(z.object({
      entryTime: z.date(),
      exitTime: z.date(),
    }))
    .query(async ({ input }) => {
      const dbReady = await isTicksDBReady();

      if (!dbReady) {
        return { ticks: [], hasRealTicks: false };
      }

      const ticks = await getTicksFromDB(input.entryTime, input.exitTime);

      return {
        ticks,
        hasRealTicks: ticks.length > 0,
      };
    }),
});
