/**
 * Servicio de Telegram para notificaciones
 *
 * Permite enviar mensajes a usuarios del SaaS via bot de Telegram.
 * Solo disponible para planes PRO y VIP.
 */

import { prisma } from "./prisma";

// Token del bot de Telegram (configurar en .env)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// URL base del SaaS (para links en mensajes)
const SAAS_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Interfaz para mensajes de Telegram
 */
interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: "Markdown" | "HTML";
  disableNotification?: boolean;
}

/**
 * Interfaz para respuestas de la API de Telegram
 */
interface TelegramApiResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
}

/**
 * Enviar mensaje via API de Telegram
 */
async function sendTelegramMessage(
  message: TelegramMessage
): Promise<TelegramApiResponse> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[Telegram] BOT_TOKEN no configurado");
    return { ok: false, description: "Bot token not configured" };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chatId,
        text: message.text,
        parse_mode: message.parseMode || "HTML",
        disable_notification: message.disableNotification || false,
      }),
    });

    const data = (await response.json()) as TelegramApiResponse;

    if (!data.ok) {
      console.error("[Telegram] Error enviando mensaje:", data.description);
    }

    return data;
  } catch (error) {
    console.error("[Telegram] Error de conexión:", error);
    return { ok: false, description: String(error) };
  }
}

/**
 * Verificar si un usuario tiene acceso a notificaciones de Telegram
 * (Planes PRO y VIP)
 */
export async function canUseTelegramNotifications(tenantId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    select: { plan: true, status: true },
  });

  if (!subscription) return false;

  // PRO y VIP tienen acceso
  const allowedPlans = ["PRO", "ENTERPRISE"];
  return allowedPlans.includes(subscription.plan) && subscription.status === "ACTIVE";
}

/**
 * Obtener el chat ID de Telegram de un usuario
 */
export async function getTelegramChatId(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { telegramChatId: true },
  });

  return tenant?.telegramChatId || null;
}

/**
 * Vincular chat de Telegram con un usuario del SaaS
 */
export async function linkTelegramChat(
  tenantId: string,
  chatId: string
): Promise<boolean> {
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { telegramChatId: chatId },
    });
    return true;
  } catch (error) {
    console.error("[Telegram] Error vinculando chat:", error);
    return false;
  }
}

/**
 * Desvincular chat de Telegram
 */
export async function unlinkTelegramChat(tenantId: string): Promise<boolean> {
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { telegramChatId: null },
    });
    return true;
  } catch (error) {
    console.error("[Telegram] Error desvinculando chat:", error);
    return false;
  }
}

// ============================================
// NOTIFICACIONES PREDEFINIDAS
// ============================================

/**
 * Notificar operación abierta
 */
export async function notifyTradeOpened(
  tenantId: string,
  data: {
    symbol: string;
    side: "BUY" | "SELL";
    price: number;
    lotSize: number;
    level: number;
  }
): Promise<boolean> {
  const chatId = await getTelegramChatId(tenantId);
  if (!chatId) return false;

  const canNotify = await canUseTelegramNotifications(tenantId);
  if (!canNotify) return false;

  const emoji = data.side === "BUY" ? "🟢" : "🔴";
  const levelText = data.level > 0 ? ` (Nivel ${data.level})` : "";

  const text = `
${emoji} <b>Operación Abierta</b>

<b>Símbolo:</b> ${data.symbol}
<b>Lado:</b> ${data.side}
<b>Precio:</b> ${data.price.toFixed(2)}
<b>Lote:</b> ${data.lotSize}${levelText}

<i>${new Date().toLocaleString("es-ES")}</i>
  `.trim();

  const result = await sendTelegramMessage({ chatId, text });
  return result.ok;
}

/**
 * Notificar operación cerrada
 */
export async function notifyTradeClosed(
  tenantId: string,
  data: {
    symbol: string;
    side: "BUY" | "SELL";
    openPrice: number;
    closePrice: number;
    profitPips: number;
    profitMoney: number;
    reason: string;
  }
): Promise<boolean> {
  const chatId = await getTelegramChatId(tenantId);
  if (!chatId) return false;

  const canNotify = await canUseTelegramNotifications(tenantId);
  if (!canNotify) return false;

  const isProfit = data.profitMoney >= 0;
  const emoji = isProfit ? "💰" : "📉";
  const profitEmoji = isProfit ? "✅" : "❌";

  const text = `
${emoji} <b>Operación Cerrada</b>

<b>Símbolo:</b> ${data.symbol}
<b>Entrada:</b> ${data.openPrice.toFixed(2)}
<b>Salida:</b> ${data.closePrice.toFixed(2)}
<b>Razón:</b> ${data.reason}

${profitEmoji} <b>P&L:</b> ${data.profitPips >= 0 ? "+" : ""}${data.profitPips.toFixed(1)} pips
${profitEmoji} <b>Resultado:</b> ${data.profitMoney >= 0 ? "+" : ""}${data.profitMoney.toFixed(2)} EUR

<i>${new Date().toLocaleString("es-ES")}</i>
  `.trim();

  const result = await sendTelegramMessage({ chatId, text });
  return result.ok;
}

/**
 * Notificar error del bot
 */
export async function notifyBotError(
  tenantId: string,
  error: string
): Promise<boolean> {
  const chatId = await getTelegramChatId(tenantId);
  if (!chatId) return false;

  const canNotify = await canUseTelegramNotifications(tenantId);
  if (!canNotify) return false;

  const text = `
⚠️ <b>Error del Bot</b>

<b>Mensaje:</b>
${error}

<a href="${SAAS_URL}/dashboard">Ver Dashboard</a>

<i>${new Date().toLocaleString("es-ES")}</i>
  `.trim();

  const result = await sendTelegramMessage({ chatId, text });
  return result.ok;
}

/**
 * Notificar Daily Loss Limit alcanzado
 */
export async function notifyDailyLossLimit(
  tenantId: string,
  data: {
    currentLoss: number;
    limitPercent: number;
    balance: number;
  }
): Promise<boolean> {
  const chatId = await getTelegramChatId(tenantId);
  if (!chatId) return false;

  const canNotify = await canUseTelegramNotifications(tenantId);
  if (!canNotify) return false;

  const text = `
🛑 <b>Daily Loss Limit Alcanzado</b>

<b>Pérdida actual:</b> ${data.currentLoss.toFixed(2)} EUR
<b>Límite:</b> ${data.limitPercent}% de ${data.balance.toFixed(2)} EUR

El bot ha sido <b>pausado automáticamente</b>.

<a href="${SAAS_URL}/dashboard">Reactivar desde Dashboard</a>

<i>${new Date().toLocaleString("es-ES")}</i>
  `.trim();

  const result = await sendTelegramMessage({ chatId, text });
  return result.ok;
}

/**
 * Notificar Kill Switch activado
 */
export async function notifyKillSwitch(
  tenantId: string,
  data: {
    positionsClosed: number;
    reason: string;
  }
): Promise<boolean> {
  const chatId = await getTelegramChatId(tenantId);
  if (!chatId) return false;

  const canNotify = await canUseTelegramNotifications(tenantId);
  if (!canNotify) return false;

  const text = `
🚨 <b>KILL SWITCH ACTIVADO</b>

<b>Posiciones cerradas:</b> ${data.positionsClosed}
<b>Razón:</b> ${data.reason}

El bot ha sido detenido.

<a href="${SAAS_URL}/dashboard">Ver Dashboard</a>

<i>${new Date().toLocaleString("es-ES")}</i>
  `.trim();

  const result = await sendTelegramMessage({ chatId, text });
  return result.ok;
}

/**
 * Notificar estado del bot (respuesta a comando)
 */
export async function sendBotStatus(
  chatId: string,
  data: {
    status: string;
    mt5Connected: boolean;
    openPositions: number;
    balance: number;
    equity: number;
    dailyPnL: number;
  }
): Promise<boolean> {
  const statusEmoji = data.status === "ONLINE" ? "🟢" : data.status === "PAUSED" ? "🟡" : "🔴";
  const mt5Emoji = data.mt5Connected ? "✅" : "❌";
  const pnlEmoji = data.dailyPnL >= 0 ? "📈" : "📉";

  const text = `
📊 <b>Estado del Bot</b>

<b>Status:</b> ${statusEmoji} ${data.status}
<b>MT5:</b> ${mt5Emoji} ${data.mt5Connected ? "Conectado" : "Desconectado"}

<b>Posiciones abiertas:</b> ${data.openPositions}
<b>Balance:</b> ${data.balance.toFixed(2)} EUR
<b>Equity:</b> ${data.equity.toFixed(2)} EUR
${pnlEmoji} <b>P&L Hoy:</b> ${data.dailyPnL >= 0 ? "+" : ""}${data.dailyPnL.toFixed(2)} EUR

<a href="${SAAS_URL}/dashboard">Ver Dashboard</a>
  `.trim();

  const result = await sendTelegramMessage({ chatId, text });
  return result.ok;
}

/**
 * Enviar mensaje personalizado
 */
export async function sendCustomMessage(
  tenantId: string,
  text: string
): Promise<boolean> {
  const chatId = await getTelegramChatId(tenantId);
  if (!chatId) return false;

  const result = await sendTelegramMessage({ chatId, text });
  return result.ok;
}

/**
 * Verificar token del bot (para health check)
 */
export async function verifyTelegramBot(): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "Bot token not configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      ok: boolean;
      result?: { username?: string };
      description?: string;
    };

    if (data.ok && data.result) {
      return { ok: true, username: data.result.username };
    }

    return { ok: false, error: data.description };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
