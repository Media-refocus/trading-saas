/**
 * POST /api/backtest/[id]/execute
 * Ejecuta un backtest existente y actualiza resultados en BD
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  BacktestEngine,
  BacktestConfig,
  Side,
} from "@/lib/backtest-engine";
import {
  TradingSignal,
  generateSyntheticTicks,
} from "@/lib/parsers/signals-csv";
import { isTicksDBReady } from "@/lib/ticks-db";
import {
  getDaysNeededForSignals,
  loadTicksByDayGrouped,
  getMarketPriceFromCache,
  getTicksForSignal as getTicksForSignalFromBatch,
} from "@/lib/ticks-batch-loader";
import { getSegmentationStats } from "@/lib/backtest-filters";

// Precios de referencia XAUUSD por mes
const XAUUSD_REFERENCE_PRICES: Record<string, number> = {
  "2024-05": 2350, "2024-06": 2330, "2024-07": 2400, "2024-08": 2470,
  "2024-09": 2560, "2024-10": 2650, "2024-11": 2620, "2024-12": 2630,
  "2025-01": 2720, "2025-02": 2850, "2025-03": 2950, "2025-04": 3200,
  "2025-05": 3300, "2025-06": 3350, "2025-07": 3400, "2025-08": 3450,
  "2025-09": 3500, "2025-10": 3550, "2025-11": 3600, "2025-12": 3650,
  "2026-01": 2700, "2026-02": 2750,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    // Verificar autenticación
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: "Usuario sin tenant" },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Buscar backtest
    const backtest = await prisma.backtest.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!backtest) {
      return NextResponse.json(
        { error: "Backtest no encontrado" },
        { status: 404 }
      );
    }

    if (backtest.status === "RUNNING") {
      return NextResponse.json(
        { error: "El backtest ya está en ejecución" },
        { status: 400 }
      );
    }

    // Actualizar estado a RUNNING
    await prisma.backtest.update({
      where: { id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        error: null,
      },
    });

    // Obtener parámetros
    const params = backtest.parameters as any;
    const config: BacktestConfig = {
      strategyName: backtest.strategyName,
      lotajeBase: params.lotajeBase ?? 0.1,
      numOrders: params.numOrders ?? 1,
      pipsDistance: params.pipsDistance ?? 10,
      maxLevels: params.maxLevels ?? 4,
      takeProfitPips: params.takeProfitPips ?? 20,
      stopLossPips: params.stopLossPips,
      useStopLoss: params.useStopLoss ?? false,
      useTrailingSL: params.useTrailingSL ?? true,
      trailingSLPercent: params.trailingSLPercent ?? 50,
      restrictionType: params.restrictionType,
      initialCapital: params.initialCapital ?? 10000,
      filters: params.filters,
    };

    // Cargar señales de Supabase (NO CSV en serverless)
    const dbSignals = await prisma.signal.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { receivedAt: 'asc' },
      take: 2000, // Limitar para rendimiento
    });

    // Convertir a formato TradingSignal
    let signals: TradingSignal[] = dbSignals.map(s => ({
      timestamp: s.receivedAt,
      closeTimestamp: s.processedAt || new Date(s.receivedAt.getTime() + 30 * 60 * 1000),
      side: (s.side === 'BUY' || s.side === 'SELL') ? s.side as 'BUY' | 'SELL' : 'BUY',
      entryPrice: s.price || 0,
      range_id: s.messageId || '',
    }));

    // Aplicar filtros
    if (params.filters) {
      signals = filterSignals(signals, params.filters);
    }

    // Verificar ticks en BD
    const dbReady = await isTicksDBReady();
    const wantsRealPrices = params.useRealPrices !== false;

    // Batch loading de ticks
    let ticksByDay: Map<string, any[]> = new Map();

    if (wantsRealPrices && dbReady && signals.length > 0) {
      const daysNeeded = getDaysNeededForSignals(signals);
      ticksByDay = await loadTicksByDayGrouped(daysNeeded);

      // Enriquecer señales con precios reales
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

    // Crear motor
    const engine = new BacktestEngine(config);
    let totalTicksProcessed = 0;

    // Procesar señales
    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];

      engine.startSignal(signal.side, signal.entryPrice, i, signal.timestamp);

      let entryTimestamp = signal.timestamp;
      if (wantsRealPrices && dbReady && ticksByDay.size > 0) {
        const firstTick = getMarketPriceFromCache(ticksByDay, signal.timestamp);
        if (firstTick) {
          entryTimestamp = firstTick.timestamp;
        }
      }

      engine.openInitialOrders(signal.entryPrice, entryTimestamp);

      // Obtener ticks
      let ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];

      if (wantsRealPrices && dbReady && ticksByDay.size > 0) {
        ticks = getTicksForSignalFromBatch(ticksByDay, signal);
      }

      if (ticks.length === 0) {
        // Generar ticks sintéticos
        const durationMs = signal.closeTimestamp
          ? signal.closeTimestamp.getTime() - signal.timestamp.getTime()
          : 30 * 60 * 1000;
        const exitPrice = signal.side === "BUY"
          ? signal.entryPrice + config.takeProfitPips * 0.1
          : signal.entryPrice - config.takeProfitPips * 0.1;
        ticks = generateSyntheticTicks(
          signal.entryPrice,
          exitPrice,
          durationMs,
          config.pipsDistance * 2,
          signal.timestamp
        );
      }

      totalTicksProcessed += ticks.length;

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

    // Obtener resultados
    const results = engine.getResults();
    const profits = results.tradeDetails.map(d => d.totalProfit);
    const segmentation = getSegmentationStats(
      signals.filter((_, i) => i < results.tradeDetails.length),
      profits
    );

    const elapsedMs = Date.now() - startTime;

    // Guardar resultados en BD
    const updated = await prisma.backtest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        // Métricas básicas
        totalTrades: results.totalTrades,
        totalProfit: results.totalProfit,
        totalProfitPips: results.totalProfitPips,
        winRate: results.winRate,
        maxDrawdown: results.maxDrawdown,
        profitFactor: results.profitFactor,
        // Capital
        finalCapital: results.finalCapital,
        profitPercent: results.profitPercent,
        maxDrawdownPercent: results.maxDrawdownPercent,
        // Métricas avanzadas
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
        // Segmentación y detalles
        segmentation: segmentation,
        results: {
          tradeDetails: results.tradeDetails,
          equityCurve: results.equityCurve,
        },
        ticksProcessed: totalTicksProcessed,
        totalTicks: totalTicksProcessed,
      },
    });

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("[API /backtest/[id]/execute] Error:", error);

    // Actualizar estado de error
    try {
      const { id } = await params;
      await prisma.backtest.update({
        where: { id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Error desconocido",
          completedAt: new Date(),
        },
      });
    } catch (updateError) {
      console.error("[API /backtest/[id]/execute] Error updating status:", updateError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
