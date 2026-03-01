/**
 * GET /api/bot/config
 *
 * Endpoint que el bot Python llama al arrancar para obtener su configuración.
 * Incluye: parámetros de trading, cuentas MT5 (con credenciales descifradas),
 * canales de Telegram, etc.
 */

import { NextRequest } from "next/server";
import {
  authenticateBot,
  getFullBotConfig,
  botErrorResponse,
  botSuccessResponse,
} from "../auth";
import { decryptCredential } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  // Autenticar bot
  const auth = await authenticateBot(request);
  if (!auth.success) {
    return auth.error;
  }

  const { botConfig } = auth;

  // Verificar estado del bot
  if (botConfig.status === "PAUSED") {
    return botErrorResponse(
      "Bot is paused. Resume from dashboard to continue.",
      403,
      "BOT_PAUSED"
    );
  }

  // Obtener config completo con cuentas
  const fullConfig = await getFullBotConfig(botConfig.id);

  if (!fullConfig) {
    return botErrorResponse("Bot configuration not found", 404, "CONFIG_NOT_FOUND");
  }

  // Descifrar credenciales de cuentas MT5
  const accounts = (fullConfig.BotAccount ?? []).map((account: { id: string; loginEnc: string; passwordEnc: string; serverEnc: string; pathEnc: string | null; symbol: string; magic: number }) => ({
    id: account.id,
    login: decryptCredential(account.loginEnc),
    password: decryptCredential(account.passwordEnc),
    server: decryptCredential(account.serverEnc),
    path: account.pathEnc ? decryptCredential(account.pathEnc) : undefined,
    symbol: account.symbol,
    magic: account.magic,
  }));

  // Descifrar credenciales de Telegram si existen
  let telegramConfig = null;
  if (fullConfig.telegramApiIdEnc && fullConfig.telegramApiHashEnc) {
    telegramConfig = {
      apiId: decryptCredential(fullConfig.telegramApiIdEnc),
      apiHash: decryptCredential(fullConfig.telegramApiHashEnc),
      session: fullConfig.telegramSessionEnc
        ? decryptCredential(fullConfig.telegramSessionEnc)
        : undefined,
      channels: fullConfig.telegramChannels || [],
    };
  }

  // Construir respuesta con formato amigable para el bot
  const response = {
    // Configuración general
    botId: fullConfig.id,
    symbol: fullConfig.symbol,
    magicNumber: fullConfig.magicNumber,

    // Parámetros de entrada (entry)
    entry: {
      lot: fullConfig.entryLot,
      numOrders: fullConfig.entryNumOrders,
      trailing: fullConfig.entryTrailingActivate
        ? {
            activate: fullConfig.entryTrailingActivate,
            step: fullConfig.entryTrailingStep ?? 10,
            back: fullConfig.entryTrailingBack ?? 20,
            buffer: fullConfig.entryTrailingBuffer ?? 1,
          }
        : undefined,
    },

    // Parámetros de grid (promedios)
    grid: {
      stepPips: fullConfig.gridStepPips,
      lot: fullConfig.gridLot,
      maxLevels: fullConfig.gridMaxLevels,
      numOrders: fullConfig.gridNumOrders,
      tolerancePips: fullConfig.gridTolerancePips,
    },

    // Restricciones
    restrictions: {
      type: fullConfig.restrictionType,
      maxLevels: fullConfig.maxLevels,
    },

    // Cuentas MT5
    accounts,

    // Configuración de Telegram
    telegram: telegramConfig,

    // Config de polling
    heartbeatIntervalSeconds: 30,
    configRefreshIntervalSeconds: 300,
  };

  return botSuccessResponse(response);
}
