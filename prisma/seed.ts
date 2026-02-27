/**
 * Seed script para Trading Bot SaaS
 * Crea datos iniciales para desarrollo y producción
 *
 * Uso: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // ============================================
  // 1. Crear Tenant de Demo
  // ============================================
  const demoTenant = await prisma.tenant.upsert({
    where: { email: 'demo@tradingbot.com' },
    update: {},
    create: {
      name: 'Demo Trading',
      email: 'demo@tradingbot.com',
    },
  });
  console.log('Tenant demo creado:', demoTenant.id);

  // ============================================
  // 2. Crear Usuario Admin
  // ============================================
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tradingbot.com' },
    update: {},
    create: {
      email: 'admin@tradingbot.com',
      name: 'Admin',
      password: hashedPassword,
      tenantId: demoTenant.id,
    },
  });
  console.log('Usuario admin creado:', adminUser.id);

  // ============================================
  // 3. Crear Usuario Demo
  // ============================================
  const demoPassword = await bcrypt.hash('demo123', 10);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@tradingbot.com' },
    update: {},
    create: {
      email: 'demo@tradingbot.com',
      name: 'Usuario Demo',
      password: demoPassword,
      tenantId: demoTenant.id,
    },
  });
  console.log('Usuario demo creado:', demoUser.id);

  // ============================================
  // 4. Crear Estrategia de Ejemplo
  // ============================================
  const exampleStrategy = await prisma.strategy.upsert({
    where: { id: 'strategy-demo-toni-g4' },
    update: {},
    create: {
      id: 'strategy-demo-toni-g4',
      tenantId: demoTenant.id,
      name: 'Toni G4 - Demo',
      description: 'Estrategia Toni G4 con parametros conservadores',
      strategyName: 'Toni G4',
      lotajeBase: 0.1,
      numOrders: 1,
      pipsDistance: 10,
      maxLevels: 4,
      takeProfitPips: 20,
      stopLossPips: null,
      useStopLoss: false,
      useTrailingSL: true,
      trailingSLPercent: 50,
      restrictionType: 'SIN_PROMEDIOS',
      isFavorite: true,
      isActive: true,
    },
  });
  console.log('Estrategia demo creada:', exampleStrategy.id);

  // ============================================
  // 5. Crear Estrategia Xisco G2
  // ============================================
  const xiscoStrategy = await prisma.strategy.upsert({
    where: { id: 'strategy-demo-xisco-g2' },
    update: {},
    create: {
      id: 'strategy-demo-xisco-g2',
      tenantId: demoTenant.id,
      name: 'Xisco G2 - Demo',
      description: 'Estrategia Xisco G2 para intradia',
      strategyName: 'Xisco G2',
      lotajeBase: 0.1,
      numOrders: 1,
      pipsDistance: 8,
      maxLevels: 3,
      takeProfitPips: 15,
      stopLossPips: null,
      useStopLoss: false,
      useTrailingSL: true,
      trailingSLPercent: 50,
      restrictionType: null,
      isFavorite: false,
      isActive: true,
    },
  });
  console.log('Estrategia Xisco creada:', xiscoStrategy.id);

  // ============================================
  // 6. Crear BotConfig de ejemplo
  // ============================================
  const apiKeyHash = await bcrypt.hash('demo-api-key-12345', 10);

  const botConfig = await prisma.botConfig.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      apiKeyHash: apiKeyHash,
      status: 'OFFLINE',
      symbol: 'XAUUSD',
      magicNumber: 20250101,
      entryLot: 0.1,
      entryNumOrders: 1,
      gridStepPips: 10,
      gridLot: 0.1,
      gridMaxLevels: 4,
      gridNumOrders: 1,
      gridTolerancePips: 1,
      maxLevels: 4,
    },
  });
  console.log('BotConfig creado:', botConfig.id);

  // ============================================
  // 7. Crear Backtest de ejemplo
  // ============================================
  const exampleBacktest = await prisma.backtest.upsert({
    where: { id: 'backtest-demo-1' },
    update: {},
    create: {
      id: 'backtest-demo-1',
      tenantId: demoTenant.id,
      name: 'Backtest Demo Enero 2024',
      strategyName: 'Toni G4',
      status: 'COMPLETED',
      parameters: {
        lotaje: 0.1,
        pipsDistance: 10,
        maxLevels: 4,
        takeProfit: 20,
        stopLoss: null,
        useStopLoss: false,
        restrictionType: 'SIN_PROMEDIOS',
      },
      totalTrades: 45,
      totalProfit: 1250.5,
      totalProfitPips: 125.05,
      winRate: 0.68,
      maxDrawdown: 250.0,
      profitFactor: 2.1,
      ticksProcessed: 1000000,
      totalTicks: 1000000,
      completedAt: new Date(),
    },
  });
  console.log('Backtest demo creado:', exampleBacktest.id);

  // ============================================
  // 8. Crear Subscription con trial
  // ============================================
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  const subscription = await prisma.subscription.upsert({
    where: { id: `sub-${demoTenant.id}` },
    update: { trialEnd },
    create: {
      id: `sub-${demoTenant.id}`,
      tenantId: demoTenant.id,
      plan: 'PRO',
      status: 'TRIAL',
      trialEnd,
    },
  });
  console.log('Subscription creada:', subscription.id, '- Trial hasta:', trialEnd.toDateString());

  // ============================================
  // 9. Crear Ticks de Demo (1000 ticks XAUUSD)
  // ============================================
  const existingTicks = await prisma.tickData.count();

  if (existingTicks > 0) {
    console.log('Ticks ya existen:', existingTicks);
  } else {
    console.log('Generando 1000 ticks de demo (XAUUSD)...');

    const ticks = [];
    const basePrice = 2000;
    const now = new Date();

    for (let i = 0; i < 1000; i++) {
      const timestamp = new Date(now.getTime() - (1000 - i) * 60000);
      const variation = (Math.random() - 0.5) * 10;
      const bid = basePrice + variation;
      const spread = 0.3;
      const ask = bid + spread;

      ticks.push({
        symbol: 'XAUUSD',
        bid: parseFloat(bid.toFixed(2)),
        ask: parseFloat(ask.toFixed(2)),
        spread,
        timestamp,
      });
    }

    const batchSize = 100;
    for (let i = 0; i < ticks.length; i += batchSize) {
      const batch = ticks.slice(i, i + batchSize);
      await prisma.tickData.createMany({ data: batch });
      process.stdout.write(`\r   Insertados: ${Math.min(i + batchSize, ticks.length)}/${ticks.length}`);
    }
    console.log('\nTicks creados: 1000');
  }

  console.log('\n========================================');
  console.log('Seed completado exitosamente!');
  console.log('========================================');
  console.log('\nCredenciales de acceso:');
  console.log('  Admin: admin@tradingbot.com / admin123');
  console.log('  Demo:  demo@tradingbot.com / demo123');
  console.log('\nAPI Key para bot: demo-api-key-12345');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
