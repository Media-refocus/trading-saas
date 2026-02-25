/**
 * OPTIMIZADOR DE PARÁMETROS - Trading Bot SaaS
 *
 * Encuentra la mejor configuración automáticamente probando
 * múltiples combinaciones de parámetros.
 *
 * v2: Integración con cache de backtest y batch loading
 */

import { BacktestEngine, BacktestConfig, BacktestResult, Side } from "./backtest-engine";
import { TradingSignal, loadSignalsFromFile, generateSyntheticTicks } from "./parsers/signals-csv";
import { getTicksFromDB, isTicksDBReady, getMarketPrice } from "./ticks-db";
import { getCachedResult, cacheResult, hashConfig } from "./backtest-cache";
import {
  preloadTicksForSignals,
  getMarketPriceFromCache,
  getTicksForSignal as getTicksForSignalFromBatch,
  getDaysNeededForSignals,
  loadTicksByDayGrouped,
} from "./ticks-batch-loader";
import path from "path";

// ==================== TIPOS ====================

export interface OptimizationParams {
  // Rangos de parámetros a optimizar
  pipsDistanceRange?: number[];      // ej: [5, 10, 15, 20]
  maxLevelsRange?: number[];         // ej: [1, 2, 3, 4, 5]
  takeProfitRange?: number[];        // ej: [10, 15, 20, 25, 30]
  trailingSLPercentRange?: number[]; // ej: [30, 40, 50, 60]

  // Parámetros fijos
  lotajeBase?: number;
  numOrders?: number;
  useStopLoss?: boolean;
  stopLossPips?: number;
  useTrailingSL?: boolean;
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
  initialCapital?: number;
}

export interface OptimizationResult {
  config: BacktestConfig;
  result: BacktestResult;
  score: number; // Puntuación compuesta
  rank: number;  // Posición en el ranking
}

export interface OptimizationProgress {
  current: number;
  total: number;
  currentConfig: BacktestConfig;
  bestSoFar: OptimizationResult | null;
  elapsedMs: number;
}

export type OptimizationCallback = (progress: OptimizationProgress) => void;

export type OptimizationMetric =
  | "totalProfit"
  | "winRate"
  | "profitFactor"
  | "sharpeRatio"
  | "calmarRatio"
  | "expectancy"
  | "minDrawdown"; // Maximizar profit con drawdown limitado

export interface OptimizationOptions {
  signalsSource: string;
  signalLimit?: number;
  metric?: OptimizationMetric;
  maxDrawdownPercent?: number; // Máximo drawdown permitido
  onProgress?: OptimizationCallback;
}

// ==================== CONSTANTES ====================

const DEFAULT_PIPS_DISTANCE = [5, 10, 15, 20];
const DEFAULT_MAX_LEVELS = [1, 2, 3, 4, 5, 6];
const DEFAULT_TAKE_PROFIT = [10, 15, 20, 25, 30];
const DEFAULT_TRAILING_SL = [30, 40, 50, 60, 70];

// ==================== FUNCIONES ====================

/**
 * Genera todas las combinaciones de parámetros
 */
export function generateCombinations(params: OptimizationParams): BacktestConfig[] {
  const pipsDistances = params.pipsDistanceRange || DEFAULT_PIPS_DISTANCE;
  const maxLevels = params.maxLevelsRange || DEFAULT_MAX_LEVELS;
  const takeProfits = params.takeProfitRange || DEFAULT_TAKE_PROFIT;
  const trailingSLs = params.trailingSLPercentRange || DEFAULT_TRAILING_SL;

  const combinations: BacktestConfig[] = [];

  for (const pipsDistance of pipsDistances) {
    for (const maxLevel of maxLevels) {
      for (const takeProfit of takeProfits) {
        for (const trailingSL of trailingSLs) {
          combinations.push({
            strategyName: `Optimized_${pipsDistance}p_${maxLevel}L_${takeProfit}TP`,
            lotajeBase: params.lotajeBase || 0.1,
            numOrders: params.numOrders || 1,
            pipsDistance,
            maxLevels: maxLevel,
            takeProfitPips: takeProfit,
            useStopLoss: params.useStopLoss || false,
            stopLossPips: params.stopLossPips,
            useTrailingSL: params.useTrailingSL !== false,
            trailingSLPercent: trailingSL,
            restrictionType: params.restrictionType,
            initialCapital: params.initialCapital || 10000,
          });
        }
      }
    }
  }

  return combinations;
}

/**
 * Calcula el score de una configuración según la métrica elegida
 */
export function calculateScore(
  result: BacktestResult,
  metric: OptimizationMetric,
  maxDrawdownPercent?: number
): number {
  // Filtrar por drawdown máximo si está especificado
  if (maxDrawdownPercent && result.maxDrawdownPercent > maxDrawdownPercent) {
    return -Infinity;
  }

  switch (metric) {
    case "totalProfit":
      return result.totalProfit;

    case "winRate":
      return result.winRate;

    case "profitFactor":
      return result.profitFactor;

    case "sharpeRatio":
      return result.sharpeRatio;

    case "calmarRatio":
      return result.calmarRatio;

    case "expectancy":
      return result.expectancy;

    case "minDrawdown":
      // Maximizar profit minimizando drawdown
      return result.totalProfit / (result.maxDrawdownPercent + 1);

    default:
      // Score compuesto: profit * winRate * profitFactor / drawdown
      return result.totalProfit * (result.winRate / 100) * result.profitFactor / (result.maxDrawdownPercent + 1);
  }
}

/**
 * Ejecuta un backtest para una configuración específica
 * v2: Usa cache de resultados y batch loading
 */
export async function runSingleBacktest(
  config: BacktestConfig,
  signals: TradingSignal[],
  useRealPrices: boolean = true,
  signalsSource: string = "signals_simple.csv",
  ticksByDay?: Map<string, any[]>
): Promise<{ result: BacktestResult; fromCache: boolean }> {
  // 1. Verificar cache primero
  const cachedResult = getCachedResult(config, signalsSource);
  if (cachedResult) {
    return { result: cachedResult, fromCache: true };
  }

  const dbReady = useRealPrices && await isTicksDBReady();
  const engine = new BacktestEngine(config);

  // Usar el cache de ticks si está disponible, si no, cargarlo
  let localTicksByDay = ticksByDay;
  if (dbReady && !localTicksByDay && signals.length > 0) {
    const daysNeeded = getDaysNeededForSignals(signals);
    localTicksByDay = await loadTicksByDayGrouped(daysNeeded);
  }

  // Precios de referencia XAUUSD por mes (fallback)
  const XAUUSD_REFERENCE_PRICES: Record<string, number> = {
    "2024-05": 2350, "2024-06": 2330, "2024-07": 2400, "2024-08": 2470,
    "2024-09": 2560, "2024-10": 2650, "2024-11": 2620, "2024-12": 2630,
    "2025-01": 2720, "2025-02": 2850, "2025-03": 2950, "2025-04": 3200,
    "2025-05": 3300, "2025-06": 3350, "2025-07": 3400, "2025-08": 3450,
    "2025-09": 3500, "2025-10": 3550, "2025-11": 3600, "2025-12": 3650,
    "2026-01": 2700, "2026-02": 2750,
  };

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];

    // Enriquecer con precio real si está disponible
    let entryPrice = signal.entryPrice;

    if (dbReady && localTicksByDay && localTicksByDay.size > 0) {
      const marketPrice = getMarketPriceFromCache(localTicksByDay, signal.timestamp);
      if (marketPrice) {
        entryPrice = (marketPrice.bid + marketPrice.ask) / 2;
      } else if (signal.entryPrice <= 0) {
        // Usar precio de referencia
        const monthKey = signal.timestamp.toISOString().slice(0, 7);
        entryPrice = XAUUSD_REFERENCE_PRICES[monthKey] || 2500;
      }
    } else if (signal.entryPrice <= 0) {
      const monthKey = signal.timestamp.toISOString().slice(0, 7);
      entryPrice = XAUUSD_REFERENCE_PRICES[monthKey] || 2500;
    }

    engine.startSignal(signal.side, entryPrice, i, signal.timestamp);

    // Obtener timestamp de entrada
    let entryTimestamp = signal.timestamp;
    if (dbReady && localTicksByDay && localTicksByDay.size > 0) {
      const firstTick = getMarketPriceFromCache(localTicksByDay, signal.timestamp);
      if (firstTick) {
        entryTimestamp = firstTick.timestamp;
      }
    }

    engine.openInitialOrders(entryPrice, entryTimestamp);

    // Obtener ticks
    let ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];

    if (dbReady && localTicksByDay && localTicksByDay.size > 0) {
      ticks = getTicksForSignalFromBatch(localTicksByDay, signal);
    }

    // Si no hay ticks reales, generar sintéticos
    if (ticks.length === 0) {
      ticks = generateSyntheticTicksForSignal(signal, config);
    }

    for (const tick of ticks) {
      engine.processTick(tick);
    }

    // Cerrar posiciones pendientes
    if (engine.hasOpenPositions() && ticks.length > 0) {
      const lastTick = ticks[ticks.length - 1];
      const closePrice = signal.side === "BUY" ? lastTick.bid : lastTick.ask;
      engine.closeRemainingPositions(closePrice, signal.closeTimestamp || lastTick.timestamp);
    }
  }

  const result = engine.getResults();

  // Guardar en cache
  cacheResult(config, signalsSource, result);

  return { result, fromCache: false };
}

/**
 * Genera ticks sintéticos para una señal (usado en optimización)
 */
function generateSyntheticTicksForSignal(
  signal: TradingSignal,
  config: BacktestConfig
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
    signal.timestamp
  );
}


/**
 * Ejecuta la optimización completa
 * v2: Usa batch loading para cargar ticks una sola vez
 */
export async function runOptimization(
  params: OptimizationParams,
  options: OptimizationOptions
): Promise<OptimizationResult[]> {
  const startTime = Date.now();
  const combinations = generateCombinations(params);
  const results: OptimizationResult[] = [];

  // Limitar a 50 combinaciones máximo para evitar timeout
  const limitedCombinations = combinations.slice(0, 50);
  if (combinations.length > 50) {
    console.log(`[Optimizer] Limitando de ${combinations.length} a 50 combinaciones`);
  }

  // Cargar señales
  const signalsPath = path.join(process.cwd(), options.signalsSource);
  let signals = await loadSignalsFromFile(signalsPath);
  if (options.signalLimit) {
    signals = signals.slice(0, options.signalLimit);
  }

  console.log(`[Optimizer] Cargadas ${signals.length} señales desde ${options.signalsSource}`);
  console.log(`[Optimizer] Evaluando ${limitedCombinations.length} combinaciones`);

  const metric = options.metric || "totalProfit";
  let bestSoFar: OptimizationResult | null = null;

  // Precargar ticks en batch (una sola vez para todas las combinaciones)
  const dbReady = await isTicksDBReady();
  let ticksByDay: Map<string, any[]> = new Map();

  if (dbReady && signals.length > 0) {
    const preloadStart = Date.now();
    const daysNeeded = getDaysNeededForSignals(signals);
    console.log(`[Optimizer] Días necesarios: ${daysNeeded.size}`);
    ticksByDay = await loadTicksByDayGrouped(daysNeeded);
    console.log(`[Optimizer] Batch loading completado en ${Date.now() - preloadStart}ms`);
  }

  let cacheHits = 0;

  for (let i = 0; i < limitedCombinations.length; i++) {
    const config = limitedCombinations[i];

    try {
      const { result, fromCache } = await runSingleBacktest(
        config,
        signals,
        true,
        options.signalsSource,
        ticksByDay
      );

      if (fromCache) {
        cacheHits++;
      }

      const score = calculateScore(result, metric, options.maxDrawdownPercent);

      const optResult: OptimizationResult = {
        config,
        result,
        score,
        rank: 0, // Se asignará después
      };

      results.push(optResult);

      if (score > (bestSoFar?.score || -Infinity)) {
        bestSoFar = optResult;
      }

      // Log de progreso cada 5 combinaciones
      if ((i + 1) % 5 === 0) {
        console.log(`[Optimizer] Progreso: ${i + 1}/${limitedCombinations.length} - Cache hits: ${cacheHits} - Best score: ${bestSoFar?.score.toFixed(2) || 'N/A'}`);
      }

      // Callback de progreso
      if (options.onProgress) {
        options.onProgress({
          current: i + 1,
          total: limitedCombinations.length,
          currentConfig: config,
          bestSoFar,
          elapsedMs: Date.now() - startTime,
        });
      }
    } catch (error) {
      console.error(`[Optimizer] Error en configuración ${config.strategyName}:`, error);
    }
  }

  // Ordenar por score y asignar ranks
  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => {
    r.rank = i + 1;
  });

  console.log(`[Optimizer] Completado en ${Date.now() - startTime}ms - Cache hits: ${cacheHits}/${limitedCombinations.length}`);

  return results;
}

/**
 * Obtiene las combinaciones recomendadas (quick optimization)
 */
export function getQuickOptimizationPresets(): OptimizationParams[] {
  return [
    {
      // Conservador: poco drawdown
      pipsDistanceRange: [15, 20],
      maxLevelsRange: [1, 2],
      takeProfitRange: [15, 20],
      trailingSLPercentRange: [40, 50],
    },
    {
      // Balanceado
      pipsDistanceRange: [10, 15],
      maxLevelsRange: [2, 3, 4],
      takeProfitRange: [15, 20, 25],
      trailingSLPercentRange: [40, 50, 60],
    },
    {
      // Agresivo: maximizar profit
      pipsDistanceRange: [5, 10],
      maxLevelsRange: [3, 4, 5, 6],
      takeProfitRange: [20, 25, 30],
      trailingSLPercentRange: [50, 60, 70],
    },
  ];
}
