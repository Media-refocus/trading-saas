/**
 * POST /api/bot/heartbeat
 *
 * Endpoint que el bot llama periódicamente (cada 30s) para:
 * - Reportar su estado (conexiones MT5/Telegram, posiciones, etc.)
 * - Recibir comandos del dashboard (PAUSE, RESUME, CLOSE_ALL, etc.)
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
  botErrorResponse,
  botSuccessResponse,
} from "../auth";
import { prisma } from "@/lib/prisma";

// Tipos de comandos que el dashboard puede enviar al bot
type BotCommand =
  | { type: "PAUSE"; reason: string }
  | { type: "RESUME" }
  | { type: "CLOSE_ALL"; reason: string }
  | { type: "UPDATE_CONFIG" }
  | { type: "RESTART"; reason: string };

interface HeartbeatRequest {
  timestamp?: string;
  version?: string;
  uptimeSeconds?: number;
  mt5Connected: boolean;
  telegramConnected: boolean;
  openPositions: number;
  pendingOrders: number;
  metrics?: {
    memoryMB: number;
    cpuPercent: number;
  };
  accounts?: {
    login: number;
    server: string;
    balance: number;
    equity: number;
    margin: number;
    openPositions: number;
  }[];
}

export async function POST(request: NextRequest) {
  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  const { botConfig } = auth;
  const botVersion = request.headers.get("x-bot-version") || "unknown";

  // Parsear body
  let body: HeartbeatRequest;
  try {
    body = await request.json();
  } catch {
    return botErrorResponse("Invalid JSON body", 400, "INVALID_BODY");
  }

  // Guardar heartbeat en DB
  await prisma.botHeartbeat.create({
    data: {
      botConfigId: botConfig.id,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      version: botVersion,
      uptimeSeconds: body.uptimeSeconds,
      mt5Connected: body.mt5Connected ?? false,
      telegramConnected: body.telegramConnected ?? false,
      openPositions: body.openPositions ?? 0,
      pendingOrders: body.pendingOrders ?? 0,
      memoryMB: body.metrics?.memoryMB,
      cpuPercent: body.metrics?.cpuPercent,
    },
  });

  // Actualizar estado del bot
  const newStatus = body.mt5Connected ? "ONLINE" : "ERROR";
  await prisma.botConfig.update({
    where: { id: botConfig.id },
    data: {
      status: newStatus,
      updatedAt: new Date(),
    },
  });

  // Actualizar métricas de cuentas si vienen
  if (body.accounts && body.accounts.length > 0) {
    for (const accountData of body.accounts) {
      // Buscar cuenta por login y server
      const accounts = await prisma.botAccount.findMany({
        where: { botConfigId: botConfig.id },
      });

      for (const account of accounts) {
        // Descifrar para comparar
        const { decryptCredential } = await import("@/lib/encryption");
        const login = decryptCredential(account.loginEnc);
        const server = decryptCredential(account.serverEnc);

        if (login === String(accountData.login) && server === accountData.server) {
          await prisma.botAccount.update({
            where: { id: account.id },
            data: {
              lastBalance: accountData.balance,
              lastEquity: accountData.equity,
              lastMargin: accountData.margin,
              lastSyncAt: new Date(),
            },
          });
          break;
        }
      }
    }
  }

  // Obtener comandos pendientes (por ahora retornamos array vacío)
  // En el futuro, estos comandos vendrían de una cola o campo en BotConfig
  const commands: BotCommand[] = [];

  // ═══════════════════════════════════════════════════════════════
  // KILL SWITCH: Si el dashboard solicitó cerrar todo
  // ═══════════════════════════════════════════════════════════════
  if (botConfig.status === "KILL_REQUESTED") {
    commands.push({ type: "CLOSE_ALL", reason: "KILL_SWITCH" });
    // Actualizar status a PAUSED después de enviar el comando
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: { status: "PAUSED" },
    });
    console.log(`[KILL_SWITCH] Enviado comando CLOSE_ALL para bot ${botConfig.id}`);
  }

  // Si el bot estaba pausado y se reanudó desde el dashboard, enviar RESUME
  if (botConfig.status === "PAUSED") {
    // El dashboard podría cambiar el status a "RESUMING" para indicar comando pendiente
    const currentConfig = await prisma.botConfig.findUnique({
      where: { id: botConfig.id },
      select: { status: true },
    });

    if (currentConfig?.status === "RESUMING") {
      commands.push({ type: "RESUME" });
      await prisma.botConfig.update({
        where: { id: botConfig.id },
        data: { status: "ONLINE" },
      });
    }
  }

  // Limpiar heartbeats antiguos (mantener últimos 1000 por bot)
  // Ejecutar en background para no bloquear la respuesta
  prisma.botHeartbeat
    .deleteMany({
      where: {
        botConfigId: botConfig.id,
        timestamp: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Más de 24h
        },
      },
    })
    .catch(() => {
      // Ignorar errores de limpieza
    });

  return botSuccessResponse({
    serverTime: new Date().toISOString(),
    commands,
  });
}
