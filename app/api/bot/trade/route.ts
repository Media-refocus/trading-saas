/**
 * POST /api/bot/trade
 *
 * Endpoint que el bot llama para reportar operaciones:
 * - OPEN: Se abrió una nueva posición
 * - CLOSE: Se cerró una posición
 * - UPDATE: Actualización de posición en vivo
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
  botErrorResponse,
  botSuccessResponse,
} from "../auth";
import { prisma } from "@/lib/prisma";

// Request para apertura
interface TradeOpenRequest {
  action: "OPEN";
  signalId?: string;
  botAccountId: string;
  mt5Ticket: number;
  side: "BUY" | "SELL";
  symbol: string;
  level: number;
  openPrice: number;
  lotSize: number;
  stopLoss?: number;
  takeProfit?: number;
  virtualSL?: number;
  openedAt?: string;
}

// Request para cierre
interface TradeCloseRequest {
  action: "CLOSE";
  mt5Ticket: number;
  botAccountId: string;
  closePrice: number;
  closeReason: "TAKE_PROFIT" | "STOP_LOSS" | "MANUAL" | "GRID_STEP" | "VIRTUAL_SL";
  profitPips: number;
  profitMoney: number;
  commission?: number;
  swap?: number;
  closedAt?: string;
}

// Request para actualización
interface TradeUpdateRequest {
  action: "UPDATE";
  mt5Ticket: number;
  botAccountId: string;
  currentPrice: number;
  stopLoss?: number;
  virtualSL?: number;
  unrealizedPL: number;
  unrealizedPips: number;
}

type TradeRequest = TradeOpenRequest | TradeCloseRequest | TradeUpdateRequest;

export async function POST(request: NextRequest) {
  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  const { botConfig } = auth;

  // Parsear body
  let body: TradeRequest;
  try {
    body = await request.json();
  } catch {
    return botErrorResponse("Invalid JSON body", 400, "INVALID_BODY");
  }

  // Validar acción
  if (!body.action || !["OPEN", "CLOSE", "UPDATE"].includes(body.action)) {
    return botErrorResponse(
      "Invalid action. Must be OPEN, CLOSE, or UPDATE",
      400,
      "INVALID_ACTION"
    );
  }

  // Verificar que el botAccount pertenece a este bot
  const botAccount = await prisma.botAccount.findFirst({
    where: {
      id: body.botAccountId,
      botConfigId: botConfig.id,
    },
  });

  if (!botAccount) {
    return botErrorResponse(
      "BotAccount not found or does not belong to this bot",
      404,
      "ACCOUNT_NOT_FOUND"
    );
  }

  switch (body.action) {
    case "OPEN":
      return handleTradeOpen(body, botConfig);
    case "CLOSE":
      return handleTradeClose(body, botConfig);
    case "UPDATE":
      return handleTradeUpdate(body, botConfig, botAccount.id);
  }
}

async function handleTradeOpen(body: TradeOpenRequest, botConfig: { id: string; tenantId: string }) {
  // Verificar que no existe un trade con el mismo ticket
  const existingTrade = await prisma.trade.findFirst({
    where: {
      mt5Ticket: body.mt5Ticket,
      status: "OPEN",
    },
  });

  if (existingTrade) {
    return botErrorResponse(
      "Trade already exists with this MT5 ticket",
      409,
      "TRADE_EXISTS"
    );
  }

  // Crear trade
  const trade = await prisma.trade.create({
    data: {
      tenantId: botConfig.tenantId,
      botConfigId: botConfig.id,
      botAccountId: body.botAccountId,
      signalId: body.signalId,
      mt5Ticket: body.mt5Ticket,
      side: body.side,
      symbol: body.symbol,
      level: body.level,
      openPrice: body.openPrice,
      lotSize: body.lotSize,
      stopLoss: body.stopLoss,
      takeProfit: body.takeProfit,
      virtualSL: body.virtualSL,
      openedAt: body.openedAt ? new Date(body.openedAt) : new Date(),
      status: "OPEN",
    },
  });

  // Crear/actualizar posición en vivo
  await prisma.botPosition.upsert({
    where: {
      botAccountId_mt5Ticket: {
        botAccountId: body.botAccountId,
        mt5Ticket: body.mt5Ticket,
      },
    },
    update: {
      symbol: body.symbol,
      side: body.side,
      level: body.level,
      openPrice: body.openPrice,
      currentPrice: body.openPrice,
      lotSize: body.lotSize,
      stopLoss: body.stopLoss,
      takeProfit: body.takeProfit,
      virtualSL: body.virtualSL,
      openedAt: body.openedAt ? new Date(body.openedAt) : new Date(),
      lastSyncAt: new Date(),
      tradeId: trade.id,
    },
    create: {
      botAccountId: body.botAccountId,
      mt5Ticket: body.mt5Ticket,
      symbol: body.symbol,
      side: body.side,
      level: body.level,
      openPrice: body.openPrice,
      currentPrice: body.openPrice,
      lotSize: body.lotSize,
      stopLoss: body.stopLoss,
      takeProfit: body.takeProfit,
      virtualSL: body.virtualSL,
      openedAt: body.openedAt ? new Date(body.openedAt) : new Date(),
      tradeId: trade.id,
    },
  });

  // Actualizar señal si viene con signalId
  if (body.signalId) {
    await prisma.signal.update({
      where: { id: body.signalId },
      data: {
        status: "EXECUTED",
        processedAt: new Date(),
      },
    });
  }

  return botSuccessResponse({
    tradeId: trade.id,
    message: "Trade opened successfully",
  });
}

async function handleTradeClose(body: TradeCloseRequest, botConfig: { id: string; tenantId: string }) {
  // Buscar trade abierto con este ticket
  const trade = await prisma.trade.findFirst({
    where: {
      mt5Ticket: body.mt5Ticket,
      status: "OPEN",
      botConfigId: botConfig.id,
    },
  });

  if (!trade) {
    return botErrorResponse(
      "Open trade not found with this MT5 ticket",
      404,
      "TRADE_NOT_FOUND"
    );
  }

  // Actualizar trade
  await prisma.trade.update({
    where: { id: trade.id },
    data: {
      closePrice: body.closePrice,
      closedAt: body.closedAt ? new Date(body.closedAt) : new Date(),
      closeReason: body.closeReason,
      profitPips: body.profitPips,
      profitMoney: body.profitMoney,
      commission: body.commission,
      swap: body.swap,
      status: "CLOSED",
    },
  });

  // Eliminar posición en vivo
  await prisma.botPosition.deleteMany({
    where: {
      botAccountId: body.botAccountId,
      mt5Ticket: body.mt5Ticket,
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // LÍMITE DE PÉRDIDA DIARIA
  // ═══════════════════════════════════════════════════════════════
  const fullBotConfig = await prisma.botConfig.findUnique({
    where: { id: botConfig.id },
    select: {
      dailyLossLimitPercent: true,
      dailyLossCurrent: true,
      dailyLossResetAt: true,
      status: true,
    },
  });

  let shouldPause = false;
  let pauseReason = "";

  if (fullBotConfig?.dailyLossLimitPercent) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Verificar si necesitamos resetear el contador (nuevo día)
    let currentLoss = fullBotConfig.dailyLossCurrent || 0;
    if (!fullBotConfig.dailyLossResetAt || new Date(fullBotConfig.dailyLossResetAt) < todayStart) {
      // Nuevo día, resetear contador
      currentLoss = 0;
    }

    // Actualizar pérdida (sumar si es pérdida, restar si es ganancia)
    if (body.profitMoney < 0) {
      currentLoss += Math.abs(body.profitMoney);
    } else {
      // Si es ganancia, reducir la pérdida acumulada (no ir debajo de 0)
      currentLoss = Math.max(0, currentLoss - body.profitMoney);
    }

    // Obtener el balance actual para calcular el límite
    const account = await prisma.botAccount.findFirst({
      where: { id: body.botAccountId },
      select: { lastBalance: true, lastEquity: true },
    });

    const balance = account?.lastBalance || 10000; // Default si no hay balance
    const limitAmount = (fullBotConfig.dailyLossLimitPercent / 100) * balance;

    // Verificar si se superó el límite
    if (currentLoss >= limitAmount) {
      shouldPause = true;
      pauseReason = `Límite de pérdida diaria superado: ${currentLoss.toFixed(2)} >= ${limitAmount.toFixed(2)} (${fullBotConfig.dailyLossLimitPercent}% de ${balance.toFixed(2)})`;
    }

    // Actualizar contador en DB
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        dailyLossCurrent: currentLoss,
        dailyLossResetAt: now,
      },
    });

    console.log(`[DAILY_LOSS] Trade closed: ${body.profitMoney}, Current loss: ${currentLoss}, Limit: ${limitAmount}`);
  }

  // Si se superó el límite, pausar el bot
  if (shouldPause) {
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: { status: "PAUSED" },
    });

    console.log(`[DAILY_LOSS] Bot paused: ${pauseReason}`);

    return botSuccessResponse({
      tradeId: trade.id,
      message: "Trade closed successfully",
      warning: pauseReason,
      botPaused: true,
      commands: [{ type: "PAUSE", reason: "DAILY_LOSS_LIMIT" }],
    });
  }

  return botSuccessResponse({
    tradeId: trade.id,
    message: "Trade closed successfully",
  });
}

async function handleTradeUpdate(
  body: TradeUpdateRequest,
  botConfig: { id: string; tenantId: string },
  botAccountId: string
) {
  // Actualizar posición en vivo
  const position = await prisma.botPosition.findUnique({
    where: {
      botAccountId_mt5Ticket: {
        botAccountId: botAccountId,
        mt5Ticket: body.mt5Ticket,
      },
    },
  });

  if (!position) {
    return botErrorResponse(
      "Position not found with this MT5 ticket",
      404,
      "POSITION_NOT_FOUND"
    );
  }

  await prisma.botPosition.update({
    where: { id: position.id },
    data: {
      currentPrice: body.currentPrice,
      stopLoss: body.stopLoss,
      virtualSL: body.virtualSL,
      unrealizedPL: body.unrealizedPL,
      unrealizedPips: body.unrealizedPips,
      lastSyncAt: new Date(),
    },
  });

  // También actualizar el trade si tiene virtualSL nuevo
  if (body.virtualSL !== undefined) {
    await prisma.trade.updateMany({
      where: {
        mt5Ticket: body.mt5Ticket,
        status: "OPEN",
      },
      data: {
        virtualSL: body.virtualSL,
      },
    });
  }

  return botSuccessResponse({
    positionId: position.id,
    message: "Position updated successfully",
  });
}
