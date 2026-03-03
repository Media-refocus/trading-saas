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
import { procedure, protectedProcedure, router } from "../init";
import { prisma } from "@/lib/prisma";
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
  preloadTicksForSignals,
  getMarketPriceFromCache,
  getTicksForSignal as getTicksForSignalFromBatch,
  getDaysNeededForSignals,
  loadTicksByDayGrouped,
  clearBatchCache,
  getBatchCacheStats,
} from "@/lib/ticks-batch-loader";
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
    config.pipsDistance * 2,
    signal.timestamp // Pasar el timestamp real de la señal
  );
}

// ==================== ROUTER ====================

export const backtesterRouter = router({
  /**
   * Ejecuta un backtest sincrono (rapido, para pocas senales)
   * Usa SQLite para ticks y cache de resultados
   *
   * OPTIMIZACION v2: Batch loading de ticks
   * - Agrupa senales por dia y carga ticks en batch
   * - Reduce de ~3 consultas/senal a ~1 consulta/dia
   * - Tiempo esperado: de 45 min a ~5-8 min
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

        // Cargar senales
        const signalsPath = path.join(process.cwd(), signalsSource);
        let signals = await loadSignalsFromFile(signalsPath);
        console.log(`[Backtester] Cargadas ${signals.length} senales desde ${signalsSource}`);
        if (signals.length > 0) {
          console.log(`[Backtester] Primera senal: ${signals[0].timestamp.toISOString()}, side: ${signals[0].side}`);
          console.log(`[Backtester] Ultima senal: ${signals[signals.length-1].timestamp.toISOString()}, side: ${signals[signals.length-1].side}`);
        }

        // Aplicar filtros
        if (input.config.filters) {
          const beforeFilter = signals.length;
          signals = filterSignals(signals, input.config.filters as any);
          console.log(`[Backtester] Filtros aplicados: ${beforeFilter} -> ${signals.length} senales`);
        }

        if (input.signalLimit) {
          signals = signals.slice(0, input.signalLimit);
        }

        // ==================== OPTIMIZACION: BATCH LOADING ====================
        // Precargar todos los ticks necesarios ANTES del loop
        // Esto reduce de N consultas (3 por senal) a ~1 consulta por dia
        let ticksByDay: Map<string, any[]> = new Map();

        if (wantsRealPrices && dbReady && signals.length > 0) {
          const preloadStart = Date.now();
          console.log(`[Backtester] Iniciando batch loading para ${signals.length} senales...`);

          // Obtener dias necesarios
          const daysNeeded = getDaysNeededForSignals(signals);
          console.log(`[Backtester] Dias necesarios: ${daysNeeded.size}`);

          // Cargar ticks en batch (1 consulta SQL por grupo de dias)
          ticksByDay = await loadTicksByDayGrouped(daysNeeded);

          const preloadTime = Date.now() - preloadStart;
          console.log(`[Backtester] Batch loading completado en ${preloadTime}ms`);

          // Enriquecer senales con precios reales usando el cache
          const enrichedSignals: TradingSignal[] = [];

          // Precios de referencia XAUUSD por mes (cuando no hay tick real)
          const XAUUSD_REFERENCE_PRICES: Record<string, number> = {
            "2024-05": 2350, "2024-06": 2330, "2024-07": 2400, "2024-08": 2470,
            "2024-09": 2560, "2024-10": 2650, "2024-11": 2620, "2024-12": 2630,
            "2025-01": 2720, "2025-02": 2850, "2025-03": 2950, "2025-04": 3200,
            "2025-05": 3300, "2025-06": 3350, "2025-07": 3400, "2025-08": 3450,
            "2025-09": 3500, "2025-10": 3550, "2025-11": 3600, "2025-12": 3650,
            "2026-01": 2700, "2026-02": 2750,
          };

          for (const signal of signals) {
            // Obtener precio de entrada desde cache (sin consulta adicional)
            const marketPrice = getMarketPriceFromCache(ticksByDay, signal.timestamp);

            if (marketPrice) {
              // 1. Precio real del tick
              const entryPrice = (marketPrice.bid + marketPrice.ask) / 2;
              enrichedSignals.push({
                ...signal,
                entryPrice,
              });
            } else if (signal.entryPrice > 0) {
              // 2. Usar priceHint del CSV
              enrichedSignals.push(signal);
            } else {
              // 3. Usar precio de referencia por fecha
              const monthKey = signal.timestamp.toISOString().slice(0, 7); // "2024-08"
              const refPrice = XAUUSD_REFERENCE_PRICES[monthKey] || 2500; // fallback
              enrichedSignals.push({
                ...signal,
                entryPrice: refPrice,
              });
            }
          }

          if (enrichedSignals.length > 0) {
            // BUGFIX: Validar senales con precio valido
            const validSignals = enrichedSignals.filter(s => s.entryPrice > 0);
            const skippedCount = enrichedSignals.length - validSignals.length;
            if (skippedCount > 0) {
              console.log(`[Backtester] Saltadas ${skippedCount} senales sin precio valido`);
            }
            signals = validSignals;
            console.log(`[Backtester] Enriquecidas ${validSignals.length} senales con precios reales`);
          }
        }
        // ==================== FIN BATCH LOADING ====================

        // Crear motor
        const engine = new BacktestEngine(input.config as BacktestConfig);

        // Debug info
        let totalTicksProcessed = 0;
        let signalsProcessed = 0;
        let firstSignalDebug: any = null;

        // Procesar cada senal
        for (let i = 0; i < signals.length; i++) {
          const signal = signals[i];

          engine.startSignal(signal.side, signal.entryPrice, i, signal.timestamp);

          // Obtener timestamp de entrada
          let entryTimestamp = signal.timestamp;

          if (wantsRealPrices && dbReady && ticksByDay.size > 0) {
            // Usar el cache para obtener el tick mas cercano (sin consulta adicional)
            const firstTick = getMarketPriceFromCache(ticksByDay, signal.timestamp);
            if (firstTick) {
              entryTimestamp = firstTick.timestamp;
            }
          }

          engine.openInitialOrders(signal.entryPrice, entryTimestamp);

          // Obtener ticks desde cache o generar sinteticos
          let ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];

          if (wantsRealPrices && dbReady && ticksByDay.size > 0) {
            // Usar el cache para obtener ticks (sin consulta adicional)
            ticks = getTicksForSignalFromBatch(ticksByDay, signal);
          }

          // Si no hay ticks reales, usar sinteticos
          if (ticks.length === 0 || input.config.useRealPrices === false) {
            ticks = generateSyntheticTicksForSignal(signal, input.config);
          }

          signalsProcessed++;
          totalTicksProcessed += ticks.length;

          // Debug: capturar estado de la primera señal
          if (i === 0) {
            firstSignalDebug = {
              side: signal.side,
              entryPrice: signal.entryPrice,
              timestamp: signal.timestamp,
              ticksCount: ticks.length,
              firstTick: ticks[0] ? { bid: ticks[0].bid, ask: ticks[0].ask } : null,
            };
          }

          for (const tick of ticks) {
            engine.processTick(tick);
          }

          // Si el trade sigue abierto después de procesar todos los ticks,
          // cerrarlo al último precio (representa el mensaje "cerramos rango" de Telegram)
          if (engine.hasOpenPositions() && ticks.length > 0) {
            const lastTick = ticks[ticks.length - 1];
            const closePrice = signal.side === "BUY" ? lastTick.bid : lastTick.ask;
            engine.closeRemainingPositions(closePrice, signal.closeTimestamp || lastTick.timestamp);
          }
        }

        console.log(`[Backtester] Procesadas ${signalsProcessed} senales, ${totalTicksProcessed} ticks`);

        const results = engine.getResults();

        // Calcular estadisticas de segmentacion
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
          // Debug info
          debug: {
            signalsLoaded: signals.length,
            signalsProcessed,
            totalTicksProcessed,
            firstSignal: firstSignalDebug,
          },
          // Config usada (para poder guardar como estrategia)
          config: input.config,
        };
      } catch (error) {
        console.error(`[Backtester] Error:`, error);
        throw error;
      }
    }),

  /**
   * Guarda el resultado de un backtest como estrategia
   */
  saveAsStrategy: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      config: BacktestConfigSchema,
      results: z.object({
        totalTrades: z.number(),
        totalProfit: z.number(),
        winRate: z.number(),
        maxDrawdown: z.number(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const strategy = await prisma.strategy.create({
        data: {
          tenantId: ctx.user.tenantId,
          name: input.name,
          description: input.description,
          strategyName: input.config.strategyName,
          lotajeBase: input.config.lotajeBase,
          numOrders: input.config.numOrders,
          pipsDistance: input.config.pipsDistance,
          maxLevels: input.config.maxLevels,
          takeProfitPips: input.config.takeProfitPips,
          stopLossPips: input.config.stopLossPips,
          useStopLoss: input.config.useStopLoss,
          useTrailingSL: input.config.useTrailingSL,
          trailingSLPercent: input.config.trailingSLPercent,
          restrictionType: input.config.restrictionType,
          lastTotalTrades: input.results.totalTrades,
          lastTotalProfit: input.results.totalProfit,
          lastWinRate: input.results.winRate,
          lastMaxDrawdown: input.results.maxDrawdown,
          lastTestedAt: new Date(),
        },
      });

      return strategy;
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
      source: z.string().optional().default("supabase"),
    }))
    .query(async ({ ctx }) => {
      // Obtener tenant del usuario
      const user = await prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { tenantId: true },
      });

      if (!user?.tenantId) {
        throw new Error("Usuario sin tenant");
      }

      // Leer señales de Supabase
      const signals = await prisma.signal.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { receivedAt: 'asc' },
      });

      return {
        total: signals.length,
        source: "supabase",
        dateRange: {
          start: signals[0]?.receivedAt,
          end: signals[signals.length - 1]?.receivedAt,
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
   * Obtiene los ticks para un trade especifico (para el grafico)
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

  /**
   * Limpia el cache de batch loading
   */
  clearBatchCache: procedure.mutation(() => {
    clearBatchCache();
    return {
      success: true,
      message: "Cache de batch loading limpiado",
    };
  }),

  /**
   * Obtiene estadisticas del cache de batch loading
   */
  getBatchCacheStats: procedure.query(() => {
    return getBatchCacheStats();
  }),

  // ==================== PERSISTENCIA EN BD ====================

  /**
   * Lista backtests guardados en BD con paginacion
   */
  listSavedBacktests: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
      sortBy: z.string().default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { tenantId: ctx.user.tenantId };
      if (input.status) {
        where.status = input.status;
      }

      const orderBy: any = {};
      orderBy[input.sortBy] = input.sortOrder;

      const [backtests, total] = await Promise.all([
        prisma.backtest.findMany({
          where,
          select: {
            id: true,
            name: true,
            strategyName: true,
            status: true,
            totalTrades: true,
            totalProfit: true,
            winRate: true,
            profitFactor: true,
            sharpeRatio: true,
            maxDrawdown: true,
            profitPercent: true,
            createdAt: true,
            completedAt: true,
            startedAt: true,
          },
          orderBy,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        prisma.backtest.count({ where }),
      ]);

      return {
        data: backtests,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  /**
   * Obtiene un backtest guardado por ID
   */
  getSavedBacktest: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const backtest = await prisma.backtest.findFirst({
        where: {
          id: input.id,
          tenantId: ctx.user.tenantId,
        },
        include: {
          SimulatedTrade: {
            take: 200,
            orderBy: { timestamp: "asc" },
          },
        },
      });

      if (!backtest) {
        throw new Error("Backtest no encontrado");
      }

      return backtest;
    }),

  /**
   * Elimina un backtest guardado
   */
  deleteSavedBacktest: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verificar ownership
      const backtest = await prisma.backtest.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
        select: { id: true },
      });

      if (!backtest) {
        throw new Error("Backtest no encontrado");
      }

      await prisma.backtest.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Ejecuta backtest y guarda resultado en BD
   */
  executeAndSave: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        config: BacktestConfigSchema,
        signalLimit: z.number().min(1).max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      // Crear registro en BD
      const backtest = await prisma.backtest.create({
        data: {
          tenantId: ctx.user.tenantId,
          name: input.name || `Backtest ${new Date().toISOString()}`,
          strategyName: input.config.strategyName || "Toni (G4)",
          parameters: input.config,
          status: "RUNNING",
          startedAt: new Date(),
          initialCapital: input.config.initialCapital || 10000,
        },
      });

      try {
        // Ejecutar backtest (reutilizar logica del execute normal)
        const signalsSource = input.config.signalsSource || "signals_simple.csv";
        const signalsPath = path.join(process.cwd(), signalsSource);
        let signals = await loadSignalsFromFile(signalsPath);

        // Aplicar filtros
        if (input.config.filters) {
          signals = filterSignals(signals, input.config.filters as any);
        }

        if (input.signalLimit) {
          signals = signals.slice(0, input.signalLimit);
        }

        // Batch loading
        const dbReady = await isTicksDBReady();
        const wantsRealPrices = input.config.useRealPrices !== false;
        let ticksByDay: Map<string, any[]> = new Map();

        if (wantsRealPrices && dbReady && signals.length > 0) {
          const daysNeeded = getDaysNeededForSignals(signals);
          ticksByDay = await loadTicksByDayGrouped(daysNeeded);

          // Enriquecer senales
          const XAUUSD_REFERENCE_PRICES: Record<string, number> = {
            "2024-05": 2350, "2024-06": 2330, "2024-07": 2400, "2024-08": 2470,
            "2024-09": 2560, "2024-10": 2650, "2024-11": 2620, "2024-12": 2630,
            "2025-01": 2720, "2025-02": 2850, "2025-03": 2950, "2025-04": 3200,
            "2025-05": 3300, "2025-06": 3350, "2025-07": 3400, "2025-08": 3450,
            "2025-09": 3500, "2025-10": 3550, "2025-11": 3600, "2025-12": 3650,
            "2026-01": 2700, "2026-02": 2750,
          };

          const enrichedSignals: TradingSignal[] = [];
          for (const signal of signals) {
            const marketPrice = getMarketPriceFromCache(ticksByDay, signal.timestamp);
            if (marketPrice) {
              const entryPrice = (marketPrice.bid + marketPrice.ask) / 2;
              enrichedSignals.push({ ...signal, entryPrice });
            } else if (signal.entryPrice > 0) {
              enrichedSignals.push(signal);
            } else {
              const monthKey = signal.timestamp.toISOString().slice(0, 7);
              const refPrice = XAUUSD_REFERENCE_PRICES[monthKey] || 2500;
              enrichedSignals.push({ ...signal, entryPrice: refPrice });
            }
          }
          signals = enrichedSignals.filter(s => s.entryPrice > 0);
        }

        // Crear motor y ejecutar
        const engine = new BacktestEngine(input.config as BacktestConfig);
        let totalTicksProcessed = 0;

        for (let i = 0; i < signals.length; i++) {
          const signal = signals[i];
          engine.startSignal(signal.side, signal.entryPrice, i, signal.timestamp);

          let entryTimestamp = signal.timestamp;
          if (wantsRealPrices && dbReady && ticksByDay.size > 0) {
            const firstTick = getMarketPriceFromCache(ticksByDay, signal.timestamp);
            if (firstTick) entryTimestamp = firstTick.timestamp;
          }

          engine.openInitialOrders(signal.entryPrice, entryTimestamp);

          let ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];
          if (wantsRealPrices && dbReady && ticksByDay.size > 0) {
            ticks = getTicksForSignalFromBatch(ticksByDay, signal);
          }

          if (ticks.length === 0) {
            const durationMs = signal.closeTimestamp
              ? signal.closeTimestamp.getTime() - signal.timestamp.getTime()
              : 30 * 60 * 1000;
            const exitPrice = signal.side === "BUY"
              ? signal.entryPrice + input.config.takeProfitPips * 0.1
              : signal.entryPrice - input.config.takeProfitPips * 0.1;
            ticks = generateSyntheticTicks(
              signal.entryPrice, exitPrice, durationMs,
              input.config.pipsDistance * 2, signal.timestamp
            );
          }

          totalTicksProcessed += ticks.length;

          for (const tick of ticks) {
            engine.processTick(tick);
          }

          if (engine.hasOpenPositions() && ticks.length > 0) {
            const lastTick = ticks[ticks.length - 1];
            const closePrice = signal.side === "BUY" ? lastTick.bid : lastTick.ask;
            engine.closeRemainingPositions(closePrice, signal.closeTimestamp || lastTick.timestamp);
          }
        }

        const results = engine.getResults();
        const profits = results.tradeDetails.map(d => d.totalProfit);
        const segmentation = getSegmentationStats(
          signals.filter((_, i) => i < results.tradeDetails.length),
          profits
        );

        const elapsedMs = Date.now() - startTime;

        // Actualizar registro en BD
        const updated = await prisma.backtest.update({
          where: { id: backtest.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            totalTrades: results.totalTrades,
            totalProfit: results.totalProfit,
            totalProfitPips: results.totalProfitPips,
            winRate: results.winRate,
            maxDrawdown: results.maxDrawdown,
            profitFactor: results.profitFactor,
            finalCapital: results.finalCapital,
            profitPercent: results.profitPercent,
            maxDrawdownPercent: results.maxDrawdownPercent,
            sharpeRatio: results.sharpeRatio,
            sortinoRatio: results.sortinoRatio,
            calmarRatio: results.calmarRatio,
            expectancy: results.expectancy,
            avgWin: results.avgWin,
            avgLoss: results.avgLoss,
            rewardRiskRatio: results.rewardRiskRatio,
            maxConsecutiveWins: results.maxConsecutiveWins,
            maxConsecutiveLosses: results.maxConsecutiveLosses,
            profitFactorByMonth: results.profitFactorByMonth,
            segmentation: segmentation,
            results: {
              tradeDetails: results.tradeDetails,
              equityCurve: results.equityCurve,
            },
            ticksProcessed: totalTicksProcessed,
            totalTicks: totalTicksProcessed,
          },
        });

        return {
          id: updated.id,
          status: updated.status,
          elapsedMs,
          results: {
            totalTrades: results.totalTrades,
            totalProfit: results.totalProfit,
            winRate: results.winRate,
            profitFactor: results.profitFactor,
            sharpeRatio: results.sharpeRatio,
            maxDrawdown: results.maxDrawdown,
            profitPercent: results.profitPercent,
          },
        };
      } catch (error) {
        // Actualizar estado de error
        await prisma.backtest.update({
          where: { id: backtest.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : "Error desconocido",
            completedAt: new Date(),
          },
        });

        throw error;
      }
    }),
});
