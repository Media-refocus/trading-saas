/**
 * Tests para endpoints REST del bot
 *
 * Usa base de datos de prueba separada (prisma/test.db)
 * configurada por tests/global-setup.ts
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/bot/config/route";
import { POST as heartbeatPost } from "@/app/api/bot/heartbeat/route";
import { POST as signalPost } from "@/app/api/bot/signal/route";
import { POST as tradePost } from "@/app/api/bot/trade/route";
import { generateApiKey } from "@/lib/api-key";
import {
  getTestPrisma,
  createTestTenant,
  createTestBotConfig,
  createTestBotAccount,
} from "../../setup";

// API key de prueba
let testApiKey: string;
let testBotConfigId: string;
let testBotAccountId: string;

describe("Bot API Endpoints", () => {
  beforeAll(async () => {
    // La DB de test ya está configurada por global-setup.ts

    // Crear tenant de prueba
    const tenant = await createTestTenant("test-bot-api@example.com");

    // Generar API key
    const { apiKey, apiKeyHash } = await generateApiKey();
    testApiKey = apiKey;

    // Crear BotConfig
    const config = await createTestBotConfig(tenant.id, apiKeyHash);
    testBotConfigId = config.id;

    // Crear BotAccount
    const account = await createTestBotAccount(config.id);
    testBotAccountId = account.id;

    console.log("✅ Test setup complete");
  }, 60000);

  beforeEach(async () => {
    // Limpiar heartbeats, señales y trades entre tests
    const prisma = getTestPrisma();
    await prisma.botHeartbeat.deleteMany({});
    await prisma.signal.deleteMany({});
    await prisma.trade.deleteMany({});
    await prisma.botPosition.deleteMany({});
  });

  describe("GET /api/bot/config", () => {
    it("should return 401 without API key", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/config");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain("Authorization");
    });

    it("should return config with valid API key", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/config", {
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "X-Bot-Version": "1.0.0-test",
        },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.symbol).toBe("XAUUSD");
      expect(data.entry).toBeDefined();
      expect(data.entry.lot).toBe(0.1);
      expect(data.grid).toBeDefined();
      expect(data.grid.stepPips).toBe(10);
      expect(data.accounts).toBeInstanceOf(Array);
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
          "X-Bot-Version": "1.0.0-test",
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
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.serverTime).toBeDefined();
      expect(data.commands).toBeInstanceOf(Array);
    });

    it("should return 400 with invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/heartbeat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: "not valid json",
      });

      const response = await heartbeatPost(request);
      expect(response.status).toBe(400);
    });

    it("should save heartbeat to database", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/heartbeat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mt5Connected: true,
          telegramConnected: false,
          openPositions: 3,
        }),
      });

      await heartbeatPost(request);

      // Verificar que se guardó en la DB
      const prisma = getTestPrisma();
      const heartbeats = await prisma.botHeartbeat.findMany({
        where: { botConfigId: testBotConfigId },
      });

      expect(heartbeats.length).toBeGreaterThan(0);
      expect(heartbeats[0].mt5Connected).toBe(true);
      expect(heartbeats[0].openPositions).toBe(3);
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
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.signalId).toBeDefined();
      expect(data.action).toBe("EXECUTE");
    });

    it("should handle close signal", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/signal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          side: "BUY",
          symbol: "XAUUSD",
          messageText: "cerramos rango",
          isCloseSignal: true,
        }),
      });

      const response = await signalPost(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.action).toBe("EXECUTE");

      // Verificar en DB
      const prisma = getTestPrisma();
      const signal = await prisma.signal.findFirst({
        where: { id: data.signalId },
      });
      expect(signal?.isCloseSignal).toBe(true);
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

    it("should require side and symbol", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/signal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageText: "Test",
        }),
      });

      const response = await signalPost(request);
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/bot/trade", () => {
    it("should create trade with OPEN action", async () => {
      const request = new NextRequest("http://localhost:3000/api/bot/trade", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "OPEN",
          botAccountId: testBotAccountId,
          mt5Ticket: 12345,
          side: "BUY",
          symbol: "XAUUSD",
          level: 0,
          openPrice: 2650.50,
          lotSize: 0.1,
        }),
      });

      const response = await tradePost(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.tradeId).toBeDefined();

      // Verificar en DB
      const prisma = getTestPrisma();
      const trade = await prisma.trade.findFirst({
        where: { id: data.tradeId },
      });
      expect(trade?.side).toBe("BUY");
      expect(trade?.level).toBe(0);
      expect(trade?.status).toBe("OPEN");
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
