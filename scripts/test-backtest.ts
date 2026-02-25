/**
 * Script para probar el backtester con datos reales
 *
 * Ejecutar con: npx tsx scripts/test-backtest.ts
 */

import { BacktestEngine, BacktestConfig, PriceTick } from "../lib/backtest-engine";
import { parseSignalsCsv, groupSignalsByRange } from "../lib/parsers/signals-csv";
import * as fs from "fs";
import * as path from "path";

// Configuración de prueba
const testConfig: BacktestConfig = {
  strategyName: "Test Real Data",
  lotajeBase: 0.01,
  numOrders: 1,
  pipsDistance: 10,
  maxLevels: 4,
  takeProfitPips: 20,
  useStopLoss: false,
  useTrailingSL: true,
  trailingSLPercent: 50,
  initialCapital: 10000,
};

async function runBacktest() {
  console.log("=== BACKTEST CON DATOS REALES ===\n");

  // 1. Cargar señales
  const signalsPath = path.join(process.cwd(), "signals_simple.csv");
  console.log(`📂 Cargando señales desde: ${signalsPath}`);

  if (!fs.existsSync(signalsPath)) {
    console.error("❌ No se encuentra el archivo de señales");
    return;
  }

  const content = fs.readFileSync(signalsPath, "utf-8");
  const rawSignals = parseSignalsCsv(content);

  console.log(`📊 Total señales raw: ${rawSignals.length}`);

  // Agrupar por rango
  const tradingSignals = groupSignalsByRange(rawSignals);

  console.log(`📈 Señales de trading: ${tradingSignals.length}`);

  if (tradingSignals.length === 0) {
    console.error("❌ No hay señales para procesar");
    return;
  }

  console.log(`   Primera señal: ${tradingSignals[0]?.timestamp.toISOString()}`);
  console.log(`   Última señal: ${tradingSignals[tradingSignals.length - 1]?.timestamp.toISOString()}`);

  // 2. Verificar datos de ticks en BD
  console.log("\n=== VERIFICANDO TICKS EN BD ===");
  let useRealTicks = false;
  let ticksFromDB: PriceTick[] = [];

  try {
    const { getTicksFromDB } = await import("../lib/ticks-db");
    const firstSignal = tradingSignals[0];
    const lastSignal = tradingSignals[tradingSignals.length - 1];

    ticksFromDB = await getTicksFromDB(
      firstSignal.timestamp,
      lastSignal.closeTimestamp || lastSignal.timestamp,
      "XAUUSD"
    );

    console.log(`✅ Ticks en BD: ${ticksFromDB.length}`);

    if (ticksFromDB.length > 0) {
      useRealTicks = true;
      console.log(`   Primer tick: ${ticksFromDB[0]?.timestamp.toISOString()}`);
      console.log(`   Último tick: ${ticksFromDB[ticksFromDB.length - 1]?.timestamp.toISOString()}`);
    }
  } catch (error) {
    console.log("⚠️ No se pudieron cargar ticks de BD:", error);
  }

  if (!useRealTicks) {
    console.log("⚠️ Usando ticks sintéticos para la prueba...");
  }

  // 3. Ejecutar backtest con las primeras 10 señales
  console.log("\n=== EJECUTANDO BACKTEST ===");
  const engine = new BacktestEngine(testConfig);

  const testSignals = tradingSignals.slice(0, 10);
  console.log(`🔄 Probando con ${testSignals.length} señales...\n`);

  for (let idx = 0; idx < testSignals.length; idx++) {
    const signal = testSignals[idx];
    console.log(`\n--- Señal ${idx + 1}: ${signal.side} @ ${signal.entryPrice.toFixed(2)} ---`);
    console.log(`   Entrada: ${signal.timestamp.toISOString()}`);
    console.log(`   Cierre estimado: ${signal.closeTimestamp?.toISOString() || "N/A"}`);

    // Iniciar señal en el engine
    engine.startSignal(signal.side, signal.entryPrice, idx, signal.timestamp);

    // Abrir posición inicial
    engine.openInitialOrders(signal.entryPrice, signal.timestamp);

    // Procesar ticks
    if (useRealTicks && ticksFromDB.length > 0) {
      // Filtrar ticks para esta señal
      const signalTicks = ticksFromDB.filter(t =>
        t.timestamp >= signal.timestamp &&
        (!signal.closeTimestamp || t.timestamp <= signal.closeTimestamp)
      );

      console.log(`   Ticks para esta señal: ${signalTicks.length}`);

      for (const tick of signalTicks) {
        const result = engine.processTick(tick);
        if (result && result.length > 0) {
          console.log(`   ✅ Cierre detectado: ${result[0].type}, profit: $${result[0].profit.toFixed(2)}`);
          break;
        }
      }
    } else {
      // Usar ticks sintéticos
      const duration = signal.closeTimestamp
        ? signal.closeTimestamp.getTime() - signal.timestamp.getTime()
        : 30 * 60 * 1000; // 30 min default

      const numTicks = 100;
      const tickInterval = duration / numTicks;

      let lastPrice = signal.entryPrice;

      for (let i = 0; i <= numTicks; i++) {
        const tickTime = new Date(signal.timestamp.getTime() + tickInterval * i);

        // Simular movimiento de precio (random walk)
        const movement = (Math.random() - 0.5) * 2;
        lastPrice = lastPrice + movement * 0.1;

        const spread = 0.2;

        const tick: PriceTick = {
          timestamp: tickTime,
          bid: lastPrice,
          ask: lastPrice + spread,
          spread,
        };

        const result = engine.processTick(tick);
        if (result && result.length > 0) {
          console.log(`   ✅ Cierre: ${result[0].type}, profit: $${result[0].profit.toFixed(2)}, pips: ${result[0].profitPips.toFixed(1)}`);
          break;
        }
      }
    }

    // Cerrar posiciones pendientes
    if (engine.hasOpenPositions()) {
      const closePrice = signal.closePrice || signal.entryPrice;
      engine.closeRemainingPositions(closePrice, signal.closeTimestamp || new Date());
      console.log(`   🔒 Cerrado manualmente @ ${closePrice.toFixed(2)}`);
    }
  }

  // 4. Mostrar resultados
  console.log("\n" + "=".repeat(50));
  console.log("=== RESULTADOS DEL BACKTEST ===");
  console.log("=".repeat(50));

  const results = engine.getResults();

  console.log(`\n📊 MÉTRICAS PRINCIPALES:`);
  console.log(`   Total trades:     ${results.totalTrades}`);
  console.log(`   Win rate:         ${results.winRate.toFixed(2)}%`);
  console.log(`   Profit total:     $${results.totalProfit.toFixed(2)}`);
  console.log(`   Profit pips:      ${results.totalProfitPips.toFixed(1)}`);
  console.log(`   Profit factor:    ${results.profitFactor.toFixed(2)}`);
  console.log(`   Max drawdown:     $${results.maxDrawdown.toFixed(2)} (${results.maxDrawdownPercent.toFixed(2)}%)`);

  console.log(`\n📈 MÉTRICAS AVANZADAS:`);
  console.log(`   Sharpe ratio:     ${results.sharpeRatio.toFixed(2)}`);
  console.log(`   Sortino ratio:    ${results.sortinoRatio.toFixed(2)}`);
  console.log(`   Calmar ratio:     ${results.calmarRatio.toFixed(2)}`);
  console.log(`   Expectancy:       $${results.expectancy.toFixed(2)}`);

  console.log(`\n💰 CAPITAL:`);
  console.log(`   Capital inicial:  $${results.initialCapital}`);
  console.log(`   Capital final:    $${results.finalCapital.toFixed(2)}`);
  console.log(`   Retorno:          ${results.profitPercent.toFixed(2)}%`);

  // Detalles de trades
  if (results.tradeDetails.length > 0) {
    console.log(`\n📋 DETALLES DE TRADES:`);
    for (const detail of results.tradeDetails) {
      const profitStr = detail.totalProfit >= 0
        ? `+$${detail.totalProfit.toFixed(2)}`
        : `-$${Math.abs(detail.totalProfit).toFixed(2)}`;
      const icon = detail.totalProfit >= 0 ? "🟢" : "🔴";
      console.log(`   ${icon} ${detail.signalSide} @ ${detail.entryPrice.toFixed(2)} → ${detail.exitPrice.toFixed(2)} | ${profitStr} | ${detail.exitReason}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ BACKTEST COMPLETADO");
  console.log("=".repeat(50) + "\n");
}

// Ejecutar
runBacktest().catch(console.error);
