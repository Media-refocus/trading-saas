/**
 * Setup helpers para tests
 *
 * NOTA: La DB de test se configura en tests/global-setup.ts que se ejecuta primero.
 * Este archivo solo exporta helpers para crear datos de test.
 */

import { prisma } from "../lib/prisma";

/**
 * Limpia todas las tablas de la DB de test
 */
export async function cleanupTestDb() {
  const tablas = [
    "botHeartbeat",
    "botPosition",
    "trade",
    "signal",
    "botAccount",
    "botConfig",
    "position",
    "tradingAccount",
    "subscription",
    "backtest",
    "simulatedTrade",
    "strategy",
    "session",
    "account",
    "user",
    "verificationToken",
    "tickData",
    "tenant",
  ];

  for (const tabla of tablas) {
    try {
      // @ts-ignore - dinámico
      await prisma[tabla]?.deleteMany();
    } catch {
      // Ignorar si la tabla no existe
    }
  }
}

/**
 * Obtiene el cliente Prisma (ya configurado por global setup)
 */
export function getTestPrisma() {
  return prisma;
}

/**
 * Crea un tenant de test
 */
export async function createTestTenant(email = "test@example.com") {
  return prisma.tenant.create({
    data: {
      name: "Test Tenant",
      email,
    },
  });
}

/**
 * Crea un BotConfig de test con API key
 */
export async function createTestBotConfig(tenantId: string, apiKeyHash: string) {
  return prisma.botConfig.create({
    data: {
      tenantId,
      apiKeyHash,
      symbol: "XAUUSD",
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
}

/**
 * Crea una BotAccount de test
 */
export async function createTestBotAccount(botConfigId: string) {
  return prisma.botAccount.create({
    data: {
      botConfigId,
      loginEnc: "PLAINTEXT:test_login",
      passwordEnc: "PLAINTEXT:test_password",
      serverEnc: "PLAINTEXT:test_server",
      symbol: "XAUUSD",
      magic: 20250101,
    },
  });
}
