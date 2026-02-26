/**
 * Router tRPC para gestión de bots desde el dashboard
 *
 * Permite:
 * - Crear/editar configuraciones de bot
 * - Gestionar cuentas MT5
 * - Ver API keys
 * - Ver estado y estadísticas
 *
 * Todos los endpoints requieren autenticación y usan el tenant del usuario.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../init";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-key";
import { encryptCredential } from "@/lib/encryption";

// ==================== SCHEMAS ====================

const TrailingConfigSchema = z.object({
  activate: z.number().min(1).max(100),
  step: z.number().min(1).max(50),
  back: z.number().min(1).max(50),
  buffer: z.number().min(0).max(10),
}).optional();

const BotConfigInputSchema = z.object({
  symbol: z.string().default("XAUUSD"),
  magicNumber: z.number().default(20250101),

  // Entry
  entryLot: z.number().min(0.01).max(10).default(0.1),
  entryNumOrders: z.number().min(1).max(5).default(1),
  entryTrailing: TrailingConfigSchema,

  // Grid
  gridStepPips: z.number().min(1).max(100).default(10),
  gridLot: z.number().min(0.01).max(10).default(0.1),
  gridMaxLevels: z.number().min(1).max(20).default(4),
  gridNumOrders: z.number().min(1).max(5).default(1),
  gridTolerancePips: z.number().min(0).max(10).default(1),

  // Restrictions
  restrictionType: z.enum(["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"]).optional(),
  maxLevels: z.number().min(1).max(20).default(4),
});

const BotAccountInputSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  server: z.string().min(1),
  path: z.string().optional(),
  symbol: z.string().default("XAUUSD"),
  magic: z.number(),
});

// ==================== ROUTER ====================

export const botRouter = router({
  /**
   * Obtiene la configuración del bot del tenant actual
   */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
      include: {
        botAccounts: {
          orderBy: { createdAt: "asc" },
        },
        heartbeats: {
          take: 1,
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!botConfig) {
      return null;
    }

    // No retornar datos sensibles
    return {
      id: botConfig.id,
      status: botConfig.status,
      symbol: botConfig.symbol,
      magicNumber: botConfig.magicNumber,
      entryLot: botConfig.entryLot,
      entryNumOrders: botConfig.entryNumOrders,
      entryTrailing: botConfig.entryTrailingActivate
        ? {
            activate: botConfig.entryTrailingActivate,
            step: botConfig.entryTrailingStep,
            back: botConfig.entryTrailingBack,
            buffer: botConfig.entryTrailingBuffer,
          }
        : null,
      gridStepPips: botConfig.gridStepPips,
      gridLot: botConfig.gridLot,
      gridMaxLevels: botConfig.gridMaxLevels,
      gridNumOrders: botConfig.gridNumOrders,
      gridTolerancePips: botConfig.gridTolerancePips,
      restrictionType: botConfig.restrictionType,
      maxLevels: botConfig.maxLevels,
      hasTelegramConfig: !!(botConfig.telegramApiIdEnc && botConfig.telegramApiHashEnc),
      telegramChannels: botConfig.telegramChannels,
      accounts: botConfig.botAccounts.map((acc) => ({
        id: acc.id,
        server: "***", // No mostrar server real
        symbol: acc.symbol,
        magic: acc.magic,
        isActive: acc.isActive,
        lastSyncAt: acc.lastSyncAt,
        lastBalance: acc.lastBalance,
        lastEquity: acc.lastEquity,
      })),
      lastHeartbeat: botConfig.heartbeats[0]
        ? {
            timestamp: botConfig.heartbeats[0].timestamp,
            mt5Connected: botConfig.heartbeats[0].mt5Connected,
            telegramConnected: botConfig.heartbeats[0].telegramConnected,
            openPositions: botConfig.heartbeats[0].openPositions,
          }
        : null,
      createdAt: botConfig.createdAt,
      updatedAt: botConfig.updatedAt,
    };
  }),

  /**
   * Crea o actualiza la configuración del bot
   */
  upsertConfig: protectedProcedure
    .input(BotConfigInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Verificar si ya existe config
      const existing = await prisma.botConfig.findUnique({
        where: { tenantId },
      });

      if (existing) {
        // Actualizar
        return prisma.botConfig.update({
          where: { id: existing.id },
          data: {
            symbol: input.symbol,
            magicNumber: input.magicNumber,
            entryLot: input.entryLot,
            entryNumOrders: input.entryNumOrders,
            entryTrailingActivate: input.entryTrailing?.activate,
            entryTrailingStep: input.entryTrailing?.step,
            entryTrailingBack: input.entryTrailing?.back,
            entryTrailingBuffer: input.entryTrailing?.buffer,
            gridStepPips: input.gridStepPips,
            gridLot: input.gridLot,
            gridMaxLevels: input.gridMaxLevels,
            gridNumOrders: input.gridNumOrders,
            gridTolerancePips: input.gridTolerancePips,
            restrictionType: input.restrictionType,
            maxLevels: input.maxLevels,
          },
        });
      } else {
        // Crear con API key nueva
        const { apiKeyHash } = await generateApiKey();

        return prisma.botConfig.create({
          data: {
            tenantId,
            apiKeyHash,
            symbol: input.symbol,
            magicNumber: input.magicNumber,
            entryLot: input.entryLot,
            entryNumOrders: input.entryNumOrders,
            entryTrailingActivate: input.entryTrailing?.activate,
            entryTrailingStep: input.entryTrailing?.step,
            entryTrailingBack: input.entryTrailing?.back,
            entryTrailingBuffer: input.entryTrailing?.buffer,
            gridStepPips: input.gridStepPips,
            gridLot: input.gridLot,
            gridMaxLevels: input.gridMaxLevels,
            gridNumOrders: input.gridNumOrders,
            gridTolerancePips: input.gridTolerancePips,
            restrictionType: input.restrictionType,
            maxLevels: input.maxLevels,
          },
        });
      }
    }),

  /**
   * Genera una nueva API key (revoca la anterior)
   * IMPORTANTE: La API key solo se muestra una vez
   */
  regenerateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
    });

    if (!botConfig) {
      throw new Error("Bot config not found");
    }

    // Generar nueva API key
    const { apiKey, apiKeyHash } = await generateApiKey();

    // Actualizar en DB
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: { apiKeyHash },
    });

    // Retornar la API key (ÚNICA VEZ que se muestra)
    return {
      apiKey,
      message:
        "⚠️ Guarda esta API key en un lugar seguro. No se volverá a mostrar.",
    };
  }),

  /**
   * Obtiene la API key actual (solo si es la primera vez)
   */
  getApiKey: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    if (!botConfig) {
      return null;
    }

    // Si createdAt === updatedAt, es nuevo y no se ha regenerado
    const isNew = botConfig.createdAt.getTime() === botConfig.updatedAt.getTime();

    return {
      exists: true,
      isNew,
      // No retornamos la key, solo info
    };
  }),

  // ==================== ACCOUNTS ====================

  /**
   * Añade una cuenta MT5 al bot
   */
  addAccount: protectedProcedure
    .input(BotAccountInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const botConfig = await prisma.botConfig.findUnique({
        where: { tenantId },
      });

      if (!botConfig) {
        throw new Error(
          "Bot config not found. Create bot config first."
        );
      }

      // Cifrar credenciales
      const account = await prisma.botAccount.create({
        data: {
          botConfigId: botConfig.id,
          loginEnc: encryptCredential(input.login),
          passwordEnc: encryptCredential(input.password),
          serverEnc: encryptCredential(input.server),
          pathEnc: input.path ? encryptCredential(input.path) : undefined,
          symbol: input.symbol,
          magic: input.magic,
        },
      });

      // No retornar credenciales
      return {
        id: account.id,
        symbol: account.symbol,
        magic: account.magic,
        isActive: account.isActive,
      };
    }),

  /**
   * Actualiza una cuenta MT5
   */
  updateAccount: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        login: z.string().optional(),
        password: z.string().optional(),
        server: z.string().optional(),
        path: z.string().optional(),
        symbol: z.string().optional(),
        magic: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const { id, ...updates } = input;

      // Verificar que la cuenta pertenece al tenant
      const account = await prisma.botAccount.findFirst({
        where: {
          id,
          botConfig: { tenantId },
        },
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      const data: Record<string, unknown> = {};

      if (updates.login) data.loginEnc = encryptCredential(updates.login);
      if (updates.password)
        data.passwordEnc = encryptCredential(updates.password);
      if (updates.server) data.serverEnc = encryptCredential(updates.server);
      if (updates.path) data.pathEnc = encryptCredential(updates.path);
      if (updates.symbol) data.symbol = updates.symbol;
      if (updates.magic !== undefined) data.magic = updates.magic;
      if (updates.isActive !== undefined) data.isActive = updates.isActive;

      return prisma.botAccount.update({
        where: { id },
        data,
      });
    }),

  /**
   * Elimina una cuenta MT5
   */
  removeAccount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Verificar que la cuenta pertenece al tenant
      const account = await prisma.botAccount.findFirst({
        where: {
          id: input.id,
          botConfig: { tenantId },
        },
      });

      if (!account) {
        throw new Error("Account not found or access denied");
      }

      return prisma.botAccount.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Lista las cuentas MT5 del bot
   */
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
      include: {
        botAccounts: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!botConfig) {
      return [];
    }

    return botConfig.botAccounts.map((acc) => ({
      id: acc.id,
      server: "***", // No mostrar server real
      symbol: acc.symbol,
      magic: acc.magic,
      isActive: acc.isActive,
      lastSyncAt: acc.lastSyncAt,
      lastBalance: acc.lastBalance,
      lastEquity: acc.lastEquity,
      lastMargin: acc.lastMargin,
      createdAt: acc.createdAt,
    }));
  }),

  // ==================== STATUS ====================

  /**
   * Obtiene el estado actual del bot
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
      include: {
        heartbeats: {
          take: 1,
          orderBy: { timestamp: "desc" },
        },
        botAccounts: {
          include: {
            positions: true,
          },
        },
      },
    });

    if (!botConfig) {
      return null;
    }

    const lastHeartbeat = botConfig.heartbeats[0];
    const isOnline =
      lastHeartbeat &&
      Date.now() - lastHeartbeat.timestamp.getTime() < 60000; // 1 minuto

    return {
      status: botConfig.status,
      isOnline: !!isOnline,
      lastHeartbeat: lastHeartbeat
        ? {
            timestamp: lastHeartbeat.timestamp,
            mt5Connected: lastHeartbeat.mt5Connected,
            telegramConnected: lastHeartbeat.telegramConnected,
            openPositions: lastHeartbeat.openPositions,
            pendingOrders: lastHeartbeat.pendingOrders,
            version: lastHeartbeat.version,
            uptimeSeconds: lastHeartbeat.uptimeSeconds,
          }
        : null,
      positions: botConfig.botAccounts.flatMap((acc) =>
        acc.positions.map((pos) => ({
          id: pos.id,
          mt5Ticket: pos.mt5Ticket,
          symbol: pos.symbol,
          side: pos.side,
          level: pos.level,
          openPrice: pos.openPrice,
          currentPrice: pos.currentPrice,
          lotSize: pos.lotSize,
          unrealizedPL: pos.unrealizedPL,
          unrealizedPips: pos.unrealizedPips,
          openedAt: pos.openedAt,
        }))
      ),
    };
  }),

  /**
   * Pausa el bot
   */
  pause: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    return prisma.botConfig.updateMany({
      where: { tenantId },
      data: { status: "PAUSED" },
    });
  }),

  /**
   * Reanuda el bot
   */
  resume: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    return prisma.botConfig.updateMany({
      where: { tenantId },
      data: { status: "RESUMING" }, // El bot lo cambiará a ONLINE en el próximo heartbeat
    });
  }),

  // ==================== HISTORY ====================

  /**
   * Obtiene el historial de trades
   */
  getTradeHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const [trades, total] = await Promise.all([
        prisma.trade.findMany({
          where: { tenantId },
          orderBy: { openedAt: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        prisma.trade.count({
          where: { tenantId },
        }),
      ]);

      return { trades, total };
    }),

  /**
   * Obtiene el historial de señales
   */
  getSignalHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const [signals, total] = await Promise.all([
        prisma.signal.findMany({
          where: { tenantId },
          orderBy: { receivedAt: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        prisma.signal.count({
          where: { tenantId },
        }),
      ]);

      return { signals, total };
    }),

  // ==================== STATS ====================

  /**
   * Obtiene estadísticas de rendimiento
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    // Obtener todos los trades cerrados
    const trades = await prisma.trade.findMany({
      where: {
        tenantId,
        status: "CLOSED",
      },
      select: {
        profitMoney: true,
        profitPips: true,
        closeReason: true,
        side: true,
        openedAt: true,
        closedAt: true,
      },
    });

    // Calcular estadísticas
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => (t.profitMoney || 0) > 0).length;
    const losingTrades = trades.filter((t) => (t.profitMoney || 0) < 0).length;

    const totalPnL = trades.reduce((sum, t) => sum + (t.profitMoney || 0), 0);
    const totalPips = trades.reduce((sum, t) => sum + (t.profitPips || 0), 0);

    const avgWin =
      winningTrades > 0
        ? trades
            .filter((t) => (t.profitMoney || 0) > 0)
            .reduce((sum, t) => sum + (t.profitMoney || 0), 0) / winningTrades
        : 0;

    const avgLoss =
      losingTrades > 0
        ? Math.abs(
            trades
              .filter((t) => (t.profitMoney || 0) < 0)
              .reduce((sum, t) => sum + (t.profitMoney || 0), 0) / losingTrades
          )
        : 0;

    // Profit factor
    const grossProfit = trades
      .filter((t) => (t.profitMoney || 0) > 0)
      .reduce((sum, t) => sum + (t.profitMoney || 0), 0);
    const grossLoss = Math.abs(
      trades
        .filter((t) => (t.profitMoney || 0) < 0)
        .reduce((sum, t) => sum + (t.profitMoney || 0), 0)
    );
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Win rate
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Estadísticas de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysTrades = trades.filter((t) => t.closedAt && new Date(t.closedAt) >= today);
    const todayPnL = todaysTrades.reduce((sum, t) => sum + (t.profitMoney || 0), 0);
    const todayTrades = todaysTrades.length;
    const todayWinRate =
      todayTrades > 0
        ? (todaysTrades.filter((t) => (t.profitMoney || 0) > 0).length / todayTrades) * 100
        : 0;

    return {
      total: {
        trades: totalTrades,
        wins: winningTrades,
        losses: losingTrades,
        winRate: Math.round(winRate * 10) / 10,
        pnl: Math.round(totalPnL * 100) / 100,
        pips: Math.round(totalPips * 10) / 10,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
      },
      today: {
        trades: todayTrades,
        pnl: Math.round(todayPnL * 100) / 100,
        winRate: Math.round(todayWinRate * 10) / 10,
      },
    };
  }),

  /**
   * Exporta trades a CSV
   */
  exportTradesCsv: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const trades = await prisma.trade.findMany({
      where: { tenantId },
      orderBy: { openedAt: "desc" },
      take: 1000,
    });

    // Generar CSV
    const headers = [
      "Ticket",
      "Symbol",
      "Side",
      "Level",
      "Lot",
      "Open Price",
      "Close Price",
      "P&L",
      "Pips",
      "Reason",
      "Opened At",
      "Closed At",
    ];

    const rows = trades.map((t) => [
      t.mt5Ticket,
      t.symbol,
      t.side,
      t.level,
      t.lotSize,
      t.openPrice || "",
      t.closePrice || "",
      t.profitMoney || 0,
      t.profitPips || 0,
      t.closeReason || "",
      t.openedAt?.toISOString() || "",
      t.closedAt?.toISOString() || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    return {
      csv,
      filename: `trades_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }),
});
