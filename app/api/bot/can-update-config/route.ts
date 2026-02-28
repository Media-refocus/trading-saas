/**
 * GET /api/bot/can-update-config
 *
 * Verifica si es seguro actualizar la configuración del bot.
 * Retorna false si hay posiciones abiertas.
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
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

  // Contar posiciones abiertas
  const openPositions = await prisma.trade.count({
    where: {
      tenantId: botConfig.tenantId,
      status: "OPEN",
    },
  });

  // Contar posiciones en vivo en BotPosition
  const livePositions = await prisma.botPosition.count({
    where: {
      botAccount: {
        botConfigId: botConfig.id,
      },
    },
  });

  const canUpdate = openPositions === 0 && livePositions === 0;

  let reason: string | null = null;
  if (!canUpdate) {
    if (openPositions > 0) {
      reason = `There are ${openPositions} open trades`;
    } else if (livePositions > 0) {
      reason = `There are ${livePositions} live positions`;
    }
  }

  return botSuccessResponse({
    can_update: canUpdate,
    open_positions: openPositions,
    live_positions: livePositions,
    reason,
  });
}
