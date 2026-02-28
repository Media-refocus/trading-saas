/**
 * GET /api/bot/status
 *
 * Endpoint para verificar el estado del bot, incluyendo:
 * - Kill switch activado/desactivado
 * - Bot pausado/reanudado
 * - Mensajes del sistema
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
  getFullBotConfig,
  botErrorResponse,
  botSuccessResponse,
} from "../auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  const { botConfig } = auth;

  // Obtener config completo
  const fullConfig = await getFullBotConfig(botConfig.id);

  if (!fullConfig) {
    return botErrorResponse("Bot configuration not found", 404, "CONFIG_NOT_FOUND");
  }

  // Verificar si hay posiciones abiertas
  const openPositions = await prisma.trade.count({
    where: {
      tenantId: botConfig.tenantId,
      status: "OPEN",
    },
  });

  // Verificar kill switch
  const killSwitch = fullConfig.status === "KILL_REQUESTED";

  // Construir respuesta
  const response = {
    status: fullConfig.status,
    kill_switch: killSwitch,
    paused: fullConfig.status === "PAUSED",
    can_update_config: openPositions === 0,
    open_positions: openPositions,
    message: getStatusMessage(fullConfig.status),
    config_version: fullConfig.updatedAt.getTime(),
  };

  return botSuccessResponse(response);
}

function getStatusMessage(status: string): string | null {
  switch (status) {
    case "ONLINE":
      return null;
    case "OFFLINE":
      return "Bot is offline";
    case "PAUSED":
      return "Bot is paused. Resume from dashboard to continue.";
    case "ERROR":
      return "Bot encountered an error. Check logs.";
    case "KILL_REQUESTED":
      return "Kill switch activated. Closing all positions.";
    default:
      return null;
  }
}
