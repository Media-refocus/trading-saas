/**
 * Telegram Notifications
 * =====================
 *
 * Sistema de notificaciones via Telegram Bot API.
 *
 * Configuracion:
 *   - Crear bot con @BotFather en Telegram
 *   - Obtener TELEGRAM_BOT_TOKEN
 *   - Usuario debe iniciar conversacion con el bot
 *   - Obtener chat ID del usuario
 *
 * Uso:
 *   import { sendTelegramMessage } from "@/lib/telegram-notifications";
 *   await sendTelegramMessage(chatId, "Mensaje de prueba");
 */

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

/**
 * Envia un mensaje de texto a un chat de Telegram
 *
 * @param chatId - ID del chat de Telegram del usuario
 * @param message - Mensaje a enviar (soporta Markdown)
 * @returns true si el mensaje se envio correctamente
 */
export async function sendTelegramMessage(
  chatId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error("[Telegram] TELEGRAM_BOT_TOKEN no configurado");
    return { success: false, error: "Bot token no configurado" };
  }

  try {
    const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Telegram] Error enviando mensaje:", data);
      return {
        success: false,
        error: data.description || "Error desconocido de Telegram API",
      };
    }

    console.log(`[Telegram] Mensaje enviado a ${chatId}`);
    return { success: true };
  } catch (error) {
    console.error("[Telegram] Error de red:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error de conexion",
    };
  }
}

/**
 * Formatea una alerta para enviarla por Telegram
 */
export function formatAlertMessage(
  type: string,
  message: string,
  timestamp: Date
): string {
  const emoji = getAlertEmoji(type);
  const time = timestamp.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
  });

  return `${emoji} *ALERTA DE TRADING*

${message}

_Tipo: ${type}_
_Fecha: ${time}_

---
_Tu Bot de Trading_`;
}

/**
 * Obtiene el emoji correspondiente al tipo de alerta
 */
function getAlertEmoji(type: string): string {
  const emojis: Record<string, string> = {
    BOT_OFFLINE: "🔴",
    BOT_ERROR: "⚠️",
    HIGH_DRAWDOWN: "📉",
    SUBSCRIPTION_EXPIRING: "💳",
  };
  return emojis[type] || "🔔";
}

/**
 * Formatea mensaje de notificacion de prueba
 */
export function formatTestMessage(): string {
  const time = new Date().toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "full",
    timeStyle: "short",
  });

  return `✅ *NOTIFICACION DE PRUEBA*

Tu configuracion de Telegram funciona correctamente.

_Fecha: ${time}_

---
_Tu Bot de Trading_`;
}

/**
 * Formatea mensaje de bienvenida al configurar
 */
export function formatWelcomeMessage(userName: string): string {
  return `👋 *Hola ${userName}!*

Tu cuenta de Telegram ha sido vinculada correctamente.

Recibiras alertas importantes sobre tu bot de trading:
• Bot offline
• Errores de operacion
• Alertas de drawdown
• Avisos de suscripcion

Puedes desactivar las notificaciones en cualquier momento desde la configuracion.

---
_Tu Bot de Trading_`;
}

/**
 * Verifica que el bot token es valido
 */
export async function verifyBotToken(): Promise<{
  valid: boolean;
  botInfo?: { username: string; name: string };
  error?: string;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return { valid: false, error: "TELEGRAM_BOT_TOKEN no configurado" };
  }

  try {
    const url = `${TELEGRAM_API_BASE}${botToken}/getMe`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      return {
        valid: false,
        error: data.description || "Token invalido",
      };
    }

    return {
      valid: true,
      botInfo: {
        username: data.result.username,
        name: data.result.first_name,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Error de conexion",
    };
  }
}
