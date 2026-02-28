/**
 * Script para poblar la base de datos con datos demo realistas
 *
 * Genera:
 * - BotConfig para el tenant
 * - BotAccount con cuenta MT5 simulada
 * - ~150 Signals (últimos 3 meses)
 * - ~200 Trades vinculados a señales
 * - BotHeartbeats (últimas 24h)
 * - ~5000 TickData para backtester
 * - 1 Backtest completado
 * - Subscription PRO ACTIVE
 *
 * Uso: npx tsx scripts/seed-demo-data.ts
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

// Configuración
const DEMO_EMAIL = "demo@tradingbot.com";
const BASE_PRICE = 2050; // Precio base XAUUSD
const PRICE_RANGE = 80; // Rango de variación (2000-2100)
const PIP_SIZE = 0.01; // Para XAUUSD, 1 pip = 0.01

// Helper para generar fechas aleatorias en rango
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper para número aleatorio en rango
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Helper para entero aleatorio en rango
function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

// Helper para elegir elemento aleatorio
function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

// Simular random walk para precios realistas
function generatePriceWalk(startPrice: number, steps: number, volatility: number): number[] {
  const prices: number[] = [startPrice];
  for (let i = 1; i < steps; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    prices.push(prices[i - 1] + change);
  }
  return prices;
}

// Generar mensaje de señal realista
function generateSignalMessage(side: "BUY" | "SELL", price: number): string {
  const sl = side === "BUY" ? price - randomInt(30, 60) : price + randomInt(30, 60);
  const tp = side === "BUY" ? price + randomInt(40, 100) : price - randomInt(40, 100);

  const templates = [
    `XAUUSD ${side} ${price.toFixed(2)} SL ${sl.toFixed(2)} TP ${tp.toFixed(2)}`,
    `GOLD ${side} @ ${price.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)}`,
    `🎯 XAUUSD ${side} Entry: ${price.toFixed(2)} SL: ${sl.toFixed(2)} TP1: ${tp.toFixed(2)}`,
    `${side} GOLD ${price.toFixed(2)} - SL ${sl.toFixed(2)} - TP ${tp.toFixed(2)}`,
  ];

  return randomChoice(templates);
}

async function main() {
  console.log("=== Seed Demo Data ===\n");
  console.log(`📧 Buscando tenant con email: ${DEMO_EMAIL}`);

  // 1. Buscar tenant y usuario existentes
  const tenant = await prisma.tenant.findFirst({
    where: { email: DEMO_EMAIL },
    include: { users: true, subscriptions: true },
  });

  if (!tenant) {
    console.error(`❌ No se encontró tenant con email ${DEMO_EMAIL}`);
    console.log("💡 Crea primero el usuario con scripts/create-test-user.ts");
    process.exit(1);
  }

  console.log(`✅ Tenant encontrado: ${tenant.id} (${tenant.name})`);
  const user = tenant.users[0];
  if (user) {
    console.log(`✅ Usuario encontrado: ${user.id}`);
  }

  // Limpiar datos demo anteriores
  console.log("\n🧹 Limpiando datos demo anteriores...");

  // Obtener botConfig existente
  const existingBotConfig = await prisma.botConfig.findUnique({
    where: { tenantId: tenant.id },
  });

  if (existingBotConfig) {
    // Limpiar en orden por foreign keys
    await prisma.botHeartbeat.deleteMany({ where: { botConfigId: existingBotConfig.id } });
    await prisma.botPosition.deleteMany({
      where: { botAccount: { botConfigId: existingBotConfig.id } },
    });
    await prisma.trade.deleteMany({ where: { botConfigId: existingBotConfig.id } });
    await prisma.signal.deleteMany({ where: { botConfigId: existingBotConfig.id } });
    await prisma.botAccount.deleteMany({ where: { botConfigId: existingBotConfig.id } });
    await prisma.botConfig.delete({ where: { id: existingBotConfig.id } });
    console.log("  ✓ Datos de bot eliminados");
  }

  // Limpiar tick data y backtests
  await prisma.simulatedTrade.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.backtest.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tickData.deleteMany({ where: { symbol: "XAUUSD" } });
  console.log("  ✓ Backtests y tick data eliminados");

  // 2. Crear/Actualizar Subscription a PRO ACTIVE
  console.log("\n📋 Creando Subscription PRO ACTIVE...");
  let subscription = tenant.subscriptions[0];
  if (subscription) {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: "PRO",
        status: "ACTIVE",
        currentPeriodStart: new Date("2026-01-01"),
        currentPeriodEnd: new Date("2026-03-01"),
      },
    });
  } else {
    subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: "PRO",
        status: "ACTIVE",
        currentPeriodStart: new Date("2026-01-01"),
        currentPeriodEnd: new Date("2026-03-01"),
      },
    });
  }
  console.log(`  ✓ Subscription: ${subscription.id} (${subscription.plan} - ${subscription.status})`);

  // 3. Crear BotConfig
  console.log("\n⚙️ Creando BotConfig...");
  const apiKeyHash = await hash("demo_api_key_" + Date.now(), 10);
  const botConfig = await prisma.botConfig.create({
    data: {
      tenantId: tenant.id,
      apiKeyHash,
      status: "ONLINE",
      symbol: "XAUUSD",
      magicNumber: 20250101,
      entryLot: 0.01,
      entryNumOrders: 1,
      gridStepPips: 10,
      gridLot: 0.02,
      gridMaxLevels: 4,
      gridNumOrders: 1,
      gridTolerancePips: 1,
      maxLevels: 4,
      dailyLossLimitPercent: 3.0,
    },
  });
  console.log(`  ✓ BotConfig: ${botConfig.id}`);

  // 4. Crear BotAccount
  console.log("\n🏦 Creando BotAccount...");
  const botAccount = await prisma.botAccount.create({
    data: {
      botConfigId: botConfig.id,
      loginEnc: "DEMO_ENCRYPTED:12345678",
      passwordEnc: "DEMO_ENCRYPTED:password123",
      serverEnc: "DEMO_ENCRYPTED:ICMarkets-Demo",
      symbol: "XAUUSD",
      magic: 20250101,
      isActive: true,
      lastBalance: 10000,
      lastEquity: 10234.56,
      lastMargin: 234.12,
      lastSyncAt: new Date(),
    },
  });
  console.log(`  ✓ BotAccount: ${botAccount.id}`);

  // 5. Generar ~150 Signals (últimos 3 meses: Dec 2025 - Feb 2026)
  console.log("\n📡 Generando ~150 señales...");
  const signalStartDate = new Date("2025-12-01");
  const signalEndDate = new Date("2026-02-28");

  const signals: Array<{
    id: string;
    side: string;
    price: number;
    receivedAt: Date;
  }> = [];

  // Distribuir señales: ~2 señales por día laboral
  const numSignals = 150;
  let currentPrice = BASE_PRICE;

  for (let i = 0; i < numSignals; i++) {
    const receivedAt = randomDate(signalStartDate, signalEndDate);
    const side = randomChoice(["BUY", "SELL"]);
    // Variar precio con tendencia ligera
    currentPrice += (Math.random() - 0.48) * 5; // Ligera tendencia alcista
    currentPrice = Math.max(2000, Math.min(2100, currentPrice));
    const price = parseFloat(currentPrice.toFixed(2));

    const signal = await prisma.signal.create({
      data: {
        tenantId: tenant.id,
        botConfigId: botConfig.id,
        side,
        symbol: "XAUUSD",
        price,
        messageText: generateSignalMessage(side as "BUY" | "SELL", price),
        receivedAt,
        status: "EXECUTED",
        processedAt: new Date(receivedAt.getTime() + randomInt(1000, 5000)),
        channelId: "demo_channel",
        channelName: "XAUUSD Premium Signals",
        maxLevels: 4,
      },
    });

    signals.push({
      id: signal.id,
      side: signal.side,
      price: signal.price!,
      receivedAt: signal.receivedAt,
    });

    if ((i + 1) % 30 === 0) {
      console.log(`  ✓ ${i + 1}/${numSignals} señales creadas`);
    }
  }
  console.log(`  ✓ Total señales: ${signals.length}`);

  // 6. Generar ~200 Trades (algunos signals generan múltiples trades por grid)
  console.log("\n📊 Generando ~200 trades...");
  const numTrades = 200;
  const openTradesTarget = randomInt(5, 8);
  let tradesCreated = 0;
  let runningEquity = 10000;
  const equityCurve: number[] = [runningEquity];

  for (let i = 0; i < numTrades; i++) {
    // Elegir una señal aleatoria
    const signal = randomChoice(signals);

    // Determinar si es trade cerrado o abierto (los últimos quedan abiertos)
    const isLastTrades = i >= numTrades - openTradesTarget;

    // Nivel de grid (0-3)
    const level = randomInt(0, 3);

    // Precio de entrada (con variación por nivel)
    const gridOffset = level * 1.0; // 1 pip entre niveles
    const openPrice =
      signal.side === "BUY"
        ? signal.price - gridOffset
        : signal.price + gridOffset;

    // Lot size basado en nivel (entradas más pequeñas en niveles altos)
    const lotSize = parseFloat((0.01 * (1 + level * 0.5)).toFixed(2));

    // SL y TP
    const slDistance = randomInt(30, 50);
    const tpDistance = randomInt(40, 80);
    const stopLoss =
      signal.side === "BUY"
        ? openPrice - slDistance * PIP_SIZE
        : openPrice + slDistance * PIP_SIZE;
    const takeProfit =
      signal.side === "BUY"
        ? openPrice + tpDistance * PIP_SIZE
        : openPrice - tpDistance * PIP_SIZE;

    // Fecha de apertura (después de la señal)
    const openedAt = new Date(
      signal.receivedAt.getTime() + randomInt(1000, 60000)
    );

    // 60% win rate
    const isWin = Math.random() < 0.6;

    let closePrice: number | null = null;
    let closedAt: Date | null = null;
    let profitPips: number | null = null;
    let profitMoney: number | null = null;
    let commission: number | null = null;
    let swap: number | null = null;
    let status = "OPEN";

    if (!isLastTrades) {
      // Trade cerrado
      status = "CLOSED";

      // Duración del trade (minutos a días)
      const durationMs = randomInt(5, 4320) * 60 * 1000; // 5 min a 3 días
      closedAt = new Date(openedAt.getTime() + durationMs);

      if (isWin) {
        // Win: cerrar cerca del TP
        const tpProximity = Math.random() * 0.3; // 0-30% del camino al TP
        closePrice =
          signal.side === "BUY"
            ? openPrice + tpDistance * PIP_SIZE * (1 - tpProximity)
            : openPrice - tpDistance * PIP_SIZE * (1 - tpProximity);
      } else {
        // Loss: cerrar cerca del SL
        const slProximity = Math.random() * 0.3;
        closePrice =
          signal.side === "BUY"
            ? openPrice - slDistance * PIP_SIZE * (1 - slProximity)
            : openPrice + slDistance * PIP_SIZE * (1 - slProximity);
      }

      // Calcular profit
      const priceDiff = closePrice - openPrice;
      profitPips = parseFloat(
        ((signal.side === "BUY" ? priceDiff : -priceDiff) / PIP_SIZE).toFixed(1)
      );

      // Profit en dinero (aproximadamente $1 por pip con 0.01 lotes en XAUUSD)
      const pipValue = lotSize * 1; // $1 por pip con 0.01 lotes
      profitMoney = parseFloat((profitPips * pipValue).toFixed(2));

      // Comisión (negativa)
      commission = parseFloat((-randomInRange(0.5, 2.0)).toFixed(2));

      // Swap (puede ser positivo o negativo)
      const daysHeld = durationMs / (24 * 60 * 60 * 1000);
      swap = parseFloat(((Math.random() - 0.6) * daysHeld * 0.5).toFixed(2));

      // Actualizar equity
      runningEquity += profitMoney + commission + swap;
      equityCurve.push(runningEquity);
    }

    const trade = await prisma.trade.create({
      data: {
        tenantId: tenant.id,
        botConfigId: botConfig.id,
        botAccountId: botAccount.id,
        signalId: signal.id,
        side: signal.side,
        symbol: "XAUUSD",
        level,
        mt5Ticket: 100000 + i,
        openPrice: parseFloat(openPrice.toFixed(2)),
        lotSize,
        openedAt,
        closePrice: closePrice ? parseFloat(closePrice.toFixed(2)) : null,
        closedAt,
        closeReason: status === "CLOSED" ? (isWin ? "TAKE_PROFIT" : "STOP_LOSS") : null,
        stopLoss: parseFloat(stopLoss.toFixed(2)),
        takeProfit: parseFloat(takeProfit.toFixed(2)),
        profitPips,
        profitMoney,
        commission,
        swap,
        status,
      },
    });

    tradesCreated++;
    if ((i + 1) % 50 === 0) {
      console.log(`  ✓ ${i + 1}/${numTrades} trades creados (equity: $${runningEquity.toFixed(2)})`);
    }
  }

  // Contar trades abiertos
  const openCount = await prisma.trade.count({
    where: { tenantId: tenant.id, status: "OPEN" },
  });
  console.log(`  ✓ Total trades: ${tradesCreated} (${openCount} abiertos)`);
  console.log(`  ✓ Equity final: $${runningEquity.toFixed(2)}`);

  // 7. Generar BotHeartbeats (últimas 24h, cada 5 min)
  console.log("\n💓 Generando heartbeats (últimas 24h)...");
  const now = new Date();
  const heartbeatStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const numHeartbeats = Math.floor((24 * 60) / 5); // 288 heartbeats

  for (let i = 0; i < numHeartbeats; i++) {
    const timestamp = new Date(heartbeatStartDate.getTime() + i * 5 * 60 * 1000);

    await prisma.botHeartbeat.create({
      data: {
        botConfigId: botConfig.id,
        timestamp,
        version: "1.0.0",
        uptimeSeconds: i * 300 + randomInt(0, 60),
        mt5Connected: true,
        telegramConnected: true,
        openPositions: i >= numHeartbeats - 10 ? openCount : randomInt(0, 5),
        pendingOrders: randomInt(0, 2),
        memoryMB: parseFloat(randomInRange(120, 180).toFixed(1)),
        cpuPercent: parseFloat(randomInRange(2, 15).toFixed(1)),
      },
    });

    if ((i + 1) % 100 === 0) {
      console.log(`  ✓ ${i + 1}/${numHeartbeats} heartbeats creados`);
    }
  }
  console.log(`  ✓ Total heartbeats: ${numHeartbeats}`);

  // 8. Generar TickData (~5000 ticks, último mes)
  console.log("\n📈 Generando ~5000 ticks para backtester...");
  const tickStartDate = new Date("2026-01-28");
  const numTicks = 5000;

  // Generar precio con random walk
  const priceWalk = generatePriceWalk(BASE_PRICE + 20, numTicks, 2);

  for (let i = 0; i < numTicks; i++) {
    // Distribuir ticks a lo largo del mes
    const tickTime = new Date(
      tickStartDate.getTime() + (i / numTicks) * 30 * 24 * 60 * 60 * 1000
    );

    const midPrice = priceWalk[i];
    const spreadPips = randomInt(20, 40); // 20-40 pips de spread
    const spread = spreadPips * PIP_SIZE;

    const bid = parseFloat((midPrice - spread / 2).toFixed(2));
    const ask = parseFloat((midPrice + spread / 2).toFixed(2));

    await prisma.tickData.create({
      data: {
        symbol: "XAUUSD",
        timestamp: tickTime,
        bid,
        ask,
        spread: parseFloat(spread.toFixed(4)),
      },
    });

    if ((i + 1) % 1000 === 0) {
      console.log(`  ✓ ${i + 1}/${numTicks} ticks creados`);
    }
  }
  console.log(`  ✓ Total ticks: ${numTicks}`);

  // 9. Crear Backtest completado
  console.log("\n🧪 Creando backtest completado...");
  const backtestStartDate = new Date("2026-02-15");
  const backtest = await prisma.backtest.create({
    data: {
      tenantId: tenant.id,
      name: "Grid Strategy Demo - Enero 2026",
      strategyName: "Grid Strategy",
      status: "COMPLETED",
      parameters: {
        entryLot: 0.01,
        gridStepPips: 10,
        gridMaxLevels: 4,
        takeProfitPips: 50,
        useTrailingSL: true,
        trailingSLPercent: 50,
      },
      totalTrades: 50,
      totalProfit: 234.56,
      totalProfitPips: 469.2,
      winRate: 58,
      maxDrawdown: 12.3,
      profitFactor: 1.3,
      startedAt: backtestStartDate,
      completedAt: new Date(backtestStartDate.getTime() + 5 * 60 * 1000),
      ticksProcessed: 5000,
      totalTicks: 5000,
    },
  });
  console.log(`  ✓ Backtest: ${backtest.id}`);

  // Crear algunos trades simulados para el backtest
  console.log("\n📊 Creando trades simulados del backtest...");
  let simTradeIndex = 0;
  for (let i = 0; i < 50; i++) {
    const simSide = randomChoice(["BUY", "SELL"]);
    const simPrice = BASE_PRICE + randomInRange(-30, 30);
    const simLot = 0.01;
    const simWin = Math.random() < 0.58;
    const simProfitPips = simWin ? randomInRange(10, 80) : -randomInRange(10, 50);
    const simProfit = simProfitPips * simLot;

    await prisma.simulatedTrade.create({
      data: {
        tenantId: tenant.id,
        backtestId: backtest.id,
        signalIndex: simTradeIndex++,
        type: "ENTRY",
        side: simSide,
        price: parseFloat(simPrice.toFixed(2)),
        lotSize: simLot,
        level: randomInt(0, 3),
        profit: parseFloat(simProfit.toFixed(2)),
        profitPips: parseFloat(simProfitPips.toFixed(1)),
        timestamp: new Date(
          backtestStartDate.getTime() + i * 30 * 60 * 1000
        ),
      },
    });
  }
  console.log(`  ✓ 50 trades simulados creados`);

  // Resumen final
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEMO DATA CREADO EXITOSAMENTE");
  console.log("=".repeat(60));
  console.log(`\n📧 Usuario: ${DEMO_EMAIL}`);
  console.log(`🏢 Tenant: ${tenant.id}`);
  console.log(`\n📊 Resumen:`);
  console.log(`   • Subscription: PRO - ACTIVE`);
  console.log(`   • BotConfig: ${botConfig.id}`);
  console.log(`   • BotAccount: ${botAccount.id}`);
  console.log(`   • Signals: ${signals.length}`);
  console.log(`   • Trades: ${tradesCreated} (${openCount} abiertos)`);
  console.log(`   • Heartbeats: ${numHeartbeats}`);
  console.log(`   • TickData: ${numTicks}`);
  console.log(`   • Backtest: ${backtest.id} (50 trades, 58% win rate)`);
  console.log(`\n💰 Equity curve: $10,000 → $${runningEquity.toFixed(2)}`);
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
