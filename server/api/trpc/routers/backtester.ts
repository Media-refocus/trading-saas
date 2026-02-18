/**
 * Router tRPC del Backtester
 *
 * Endpoints:
 * - execute: Ejecuta un backtest con la configuración dada
 * - getSignals: Obtiene las señales disponibles
 * - getResults: Obtiene resultados de un backtest ejecutado
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
  enrichSignalsWithRealPrices,
} from "@/lib/parsers/ticks-loader";
import path from "path";

// ==================== SCHEMAS ====================

const BacktestConfigSchema = z.object({
  strategyName: z.string().default("Toni (G4)"),
  lotajeBase: z.number().min(0.01).max(10).default(0.1),
  numOrders: z.number().min(1).max(5).default(1),
  pipsDistance: z.number().min(1).max(100).default(10),
  maxLevels: z.number().min(1).max(40).default(4),
  takeProfitPips: z.number().min(5).max(100).default(20),
  stopLossPips: z.number().min(0).max(500).optional(),
  useStopLoss: z.boolean().default(false),
  restrictionType: z.enum(["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"]).optional(),
  // Fuente de señales
  signalsSource: z.string().optional().default("signals_simple.csv"),
  useRealPrices: z.boolean().optional().default(true), // Enriquecer con precios reales
});

// ==================== STORE (en memoria por ahora) ====================

interface BacktestJob {
  id: string;
  status: "pending" | "running" | "completed" | "error";
  config: BacktestConfig;
  results?: BacktestResult;
  error?: string;
  progress: number;
}

const backtestJobs = new Map<string, BacktestJob>();

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
    : 30 * 60 * 1000; // 30 min por defecto

  // Calcular precio de salida simulado
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
   * Ejecuta un backtest
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

      // Inicializar job
      const job: BacktestJob = {
        id: jobId,
        status: "running",
        config: input.config as BacktestConfig,
        progress: 0,
      };
      backtestJobs.set(jobId, job);

      try {
        // Verificar si hay ticks reales disponibles
        const useRealTicks = hasTicksData();
        console.log(`[Backtester] Usando ticks ${useRealTicks ? "REALES" : "SINTÉTICOS"}`);

        // Cargar señales desde la fuente especificada
        const signalsSource = input.config.signalsSource || "signals_simple.csv";
        const signalsPath = path.join(process.cwd(), signalsSource);
        let signals = await loadSignalsFromFile(signalsPath);

        // Limitar si se especifica
        if (input.signalLimit) {
          signals = signals.slice(0, input.signalLimit);
        }

        // Enriquecer con precios reales si está disponible y solicitado
        if (useRealTicks && input.config.useRealPrices !== false) {
          console.log(`[Backtester] Enriqueciendo ${signals.length} señales con precios reales...`);
          signals = await enrichSignalsWithRealPrices(signals);
          const withPrices = signals.filter(s => s.entryPrice > 0);
          console.log(`[Backtester] ${withPrices.length} señales con precio real encontrado`);
        }

        // Crear motor de backtest
        const engine = new BacktestEngine(input.config as BacktestConfig);

        // Simular cada señal
        for (let i = 0; i < signals.length; i++) {
          const signal = signals[i];
          job.progress = Math.round((i / signals.length) * 100);

          // Iniciar señal
          engine.startSignal(signal.side, signal.entryPrice);

          // Abrir operaciones iniciales
          engine.openInitialOrders(signal.entryPrice);

          // Obtener ticks: reales o sintéticos
          let ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];

          if (useRealTicks) {
            // Intentar cargar ticks reales para esta señal
            try {
              const realTicks = await getTicksForSignal(
                signal.timestamp,
                signal.closeTimestamp
              );

              if (realTicks.length > 0) {
                ticks = realTicks;
              } else {
                // No hay ticks reales para este período, usar sintéticos
                ticks = generateSyntheticTicksForSignal(signal, input.config);
              }
            } catch (error) {
              console.warn(`[Backtester] Error cargando ticks reales para señal ${i}:`, error);
              ticks = generateSyntheticTicksForSignal(signal, input.config);
            }
          } else {
            // Fallback a ticks sintéticos
            ticks = generateSyntheticTicksForSignal(signal, input.config);
          }

          // Procesar cada tick
          for (const tick of ticks) {
            engine.processTick(tick);
          }
        }

        // Obtener resultados
        const results = engine.getResults();

        // Actualizar job
        job.status = "completed";
        job.results = results;
        job.progress = 100;

        return {
          jobId,
          status: "completed",
          results,
        };
      } catch (error) {
        job.status = "error";
        job.error = error instanceof Error ? error.message : "Unknown error";
        throw error;
      }
    }),

  /**
   * Obtiene el estado de un backtest
   */
  getStatus: procedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = backtestJobs.get(input.jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
      };
    }),

  /**
   * Obtiene los resultados de un backtest
   */
  getResults: procedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = backtestJobs.get(input.jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      if (job.status !== "completed") {
        throw new Error("Backtest not completed");
      }
      return job.results;
    }),

  /**
   * Obtiene información de las señales disponibles
   */
  getSignalsInfo: procedure.query(async () => {
    const signalsPath = path.join(process.cwd(), "signals_simple.csv");
    const signals = await loadSignalsFromFile(signalsPath);

    return {
      total: signals.length,
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
   * Obtiene los últimos backtests ejecutados
   */
  getHistory: procedure.query(() => {
    const jobs = Array.from(backtestJobs.values())
      .filter((j) => j.status === "completed")
      .slice(-10)
      .reverse();

    return jobs.map((j) => ({
      id: j.id,
      strategyName: j.config.strategyName,
      totalTrades: j.results?.totalTrades,
      totalProfit: j.results?.totalProfit,
      winRate: j.results?.winRate,
      maxDrawdown: j.results?.maxDrawdown,
    }));
  }),

  /**
   * Obtiene información sobre los datos de ticks disponibles
   */
  getTicksInfo: procedure.query(() => {
    const hasRealTicks = hasTicksData();
    const info = getTicksInfo();

    return {
      hasRealTicks,
      files: info.files,
      totalSizeMB: info.totalSizeMB,
    };
  }),
});
