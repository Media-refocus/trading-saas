/**
 * BACKTEST OPTIMIZADO - Carga ticks solo cuando se necesitan
 */

import { BacktestEngine, BacktestConfig, PriceTick } from "../lib/backtest-engine";
import { parseSignalsCsv, groupSignalsByRange } from "../lib/parsers/signals-csv";
import { getTicksFromDB, getTicksStats } from "../lib/ticks-db-better";
import * as fs from "fs";
import * as path from "path";

const testConfig: BacktestConfig = {
  strategyName: "Test Real Data Optimizado",
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
  console.log("=== BACKTEST OPTIMIZADO CON DATOS REALES ===\n");

  // 1. Estadísticas de la BD
  console.log("📊 Verificando BD de ticks...");
  const stats = await getTicksStats();
  console.log(`   Total ticks: ${stats.totalTicks.toLocaleString()}`);
  console.log(`   Rango: ${stats.firstTick?.toISOString()} → ${stats.lastTick?.toISOString()}`);

  // 2. Cargar señales
  const signalsPath = path.join(process.cwd(), "signals_simple.csv");
  const content = fs.readFileSync(signalsPath, "utf-8");
  const rawSignals = parseSignalsCsv(content);
  const tradingSignals = groupSignalsByRange(rawSignals);

  console.log(`\n📈 Señales: ${tradingSignals.length}`);
  console.log(`   Primera: ${tradingSignals[0]?.timestamp.toISOString()}`);
  console.log(`   Última: ${tradingSignals[tradingSignals.length - 1]?.timestamp.toISOString()}`);

  // 3. Probar solo 5 señales
  const testSignals = tradingSignals.slice(0, 5);
  console.log(`\n🔄 Probando ${testSignals.length} señales...\n`);

  const engine = new BacktestEngine(testConfig);

  for (let idx = 0; idx < testSignals.length; idx++) {
    const signal = testSignals[idx];
    console.log(`\n--- Señal ${idx + 1}: ${signal.side} @ ${signal.entryPrice.toFixed(2)} ---`);
    console.log(`   Entrada: ${signal.timestamp.toISOString()}`);

    // Cargar ticks SOLO para esta señal
    const signalStart = signal.timestamp;
    const signalEnd = signal.closeTimestamp || new Date(signal.timestamp.getTime() + 60 * 60 * 1000);

    console.log(`   Buscando ticks: ${signalStart.toISOString()} → ${signalEnd.toISOString()}`);

    const ticks = await getTicksFromDB(signalStart, signalEnd, "XAUUSD");
    console.log(`   Ticks encontrados: ${ticks.length}`);

    // Iniciar señal
    engine.startSignal(signal.side, signal.entryPrice, idx, signal.timestamp);
    engine.openInitialOrders(signal.entryPrice, signal.timestamp);

    // Procesar ticks
    let closed = false;
    for (const tick of ticks) {
      const result = engine.processTick(tick);
      if (result && result.length > 0) {
        console.log(`   ✅ Cierre: ${result[0].type}, profit: $${result[0].profit.toFixed(2)}`);
        closed = true;
        break;
      }
    }

    if (!closed && engine.hasOpenPositions()) {
      const closePrice = ticks.length > 0 ? ticks[ticks.length - 1].bid : signal.entryPrice;
      engine.closeRemainingPositions(closePrice, signalEnd);
      console.log(`   🔒 Cerrado manualmente @ ${closePrice.toFixed(2)}`);
    }
  }

  // 4. Resultados
  console.log("\n" + "=".repeat(50));
  console.log("=== RESULTADOS ===");
  console.log("=".repeat(50));

  const results = engine.getResults();

  console.log(`\n📊 Total trades: ${results.totalTrades}`);
  console.log(`📊 Win rate: ${results.winRate.toFixed(1)}%`);
  console.log(`💰 Profit: $${results.totalProfit.toFixed(2)}`);
  console.log(`📈 Pips: ${results.totalProfitPips.toFixed(1)}`);

  console.log("\n✅ BACKTEST COMPLETADO CON DATOS REALES");
}

runBacktest().catch(console.error);
