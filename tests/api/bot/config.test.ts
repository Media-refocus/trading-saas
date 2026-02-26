/**
 * Tests para endpoints REST del bot
 *
 * Estos tests verifican la API que el bot Python usa para comunicarse con el SaaS.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/bot/config/route";
import { POST as heartbeatPost } from "@/app/api/bot/heartbeat/route";
import { POST as signalPost } from "@/app/api/bot/signal/route";
import { POST as tradePost } from "@/app/api/bot/trade/route";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-key";

// API key de prueba
let testApiKey: string;
let testBotConfigId: string;

describe("Bot API Endpoints", () => {
  beforeAll(async () => {
    // Crear tenant de prueba si no existe
    let tenant = await prisma.tenant.findFirst({
      where: { email: "test-bot@example.com" },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: "Test Bot Tenant",
          email: "test-bot@example.com",
        },
      });
    }

    // Generar API key
    const { apiKey, apiKeyHash } = await generateApiKey();
    testApiKey = apiKey;

    // Crear o actualizar BotConfig
    const existingConfig = await prisma.botConfig.findUnique({
      where: { tenantId: tenant.id },
    });

    if (!existingConfig) {
      const config = await prisma.botConfig.create({
        data: {
          tenantId: tenant.id,
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
      testBotConfigId = config.id;
    } else {
      testBotConfigId = existingConfig.id;
      await prisma.botConfig.update({
        where: { id: existingConfig.id },
        data: { apiKeyHash },
      });
    }

    console.log("Test setup complete. BotConfig ID:", testBotConfigId);
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.botHeartbeat.deleteMany({
      where: { botConfigId: testBotConfigId },
    });
    await prisma.signal.deleteMany({
      where: { botConfigId: testBotConfigId },
    });
    await prisma.trade.deleteMany({
      where: { botConfigId: testBotConfigId },
    });

    await prisma.$disconnect();
  });

  describe("GET /api/bot/config", () => {
    it("should return 401 without API key", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/config");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should return config with valid API key", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/config", {
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "X-Bot-Version": "1.0.0",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.symbol).toBe("XAUUSD");
      expect(data.entry).toBeDefined();
      expect(data.grid).toBeDefined();
      expect(data.accounts).toBeDefined();
    });
  });

  describe("POST /api/bot/heartbeat", () => {
    it("should return 401 without API key", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/heartbeat", {
        method: "POST",
        body: JSON.stringify({ mt5Connected: true, telegramConnected: true }),
      });

      const response = await heartbeatPost(request);
      expect(response.status).toBe(401);
    });

    it("should accept heartbeat with valid data", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/heartbeat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "X-Bot-Version": "1.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mt5Connected: true,
          telegramConnected: true,
          openPositions: 2,
          pendingOrders: 0,
          uptimeSeconds: 3600,
        }),
      });

      const response = await heartbeatPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.serverTime).toBeDefined();
      expect(data.commands).toBeDefined();
    });

    it("should return 400 with invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/heartbeat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      const response = await heartbeatPost(request);
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/bot/signal", () => {
    it("should create signal with valid data", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/signal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          side: "BUY",
          symbol: "XAUUSD",
          messageText: "BUY XAUUSD 2650.50",
          channelId: "123456789",
        }),
      });

      const response = await signalPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.signalId).toBeDefined();
      expect(data.action).toBe("EXECUTE");
    });

    it("should reject invalid side", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/signal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          side: "INVALID",
          symbol: "XAUUSD",
          messageText: "Test",
        }),
      });

      const response = await signalPost(request);
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/bot/trade", () => {
    it("should create trade with OPEN action", async () => {
      // Primero crear una cuenta de bot
      const botAccount = await prisma.botAccount.create({
        data: {
          botConfigId: testBotConfigId,
          loginEnc: "encrypted_login",
          passwordEnc: "encrypted_password",
          serverEnc: "encrypted_server",
          symbol: "XAUUSD",
          magic: 20250101,
        },
      });

      const request = new NextRequest("http://localhost:3000/api/bot/trade", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "OPEN",
          botAccountId: botAccount.id,
          mt5Ticket: 12345,
          side: "BUY",
          symbol: "XAUUSD",
          level: 0,
          openPrice: 2650.50,
          lotSize: 0.1,
        }),
      });

      const response = await tradePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tradeId).toBeDefined();
    });

    it("should reject invalid action", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/trade", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "INVALID",
        }),
      });

      const response = await tradePost(request);
      expect(response.status).toBe(400);
    });

    it("should reject non-existent bot account", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/trade", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "OPEN",
          botAccountId: "non-existent-id",
          mt5Ticket: 12345,
          side: "BUY",
          symbol: "XAUUSD",
          level: 0,
          openPrice: 2650.50,
          lotSize: 0.1,
        }),
      });

      const response = await tradePost(request);
      expect(response.status).toBe(404);
    });
  });
});
