/**
 * Webhook endpoint para Telegram Bot
 *
 * Recibe updates de Telegram cuando los usuarios interactúan con el bot.
 * Comandos disponibles:
 * - /start - Vincular cuenta
 * - /status - Estado del bot
 * - /positions - Posiciones abiertas
 * - /balance - Balance y equity
 * - /stop - Pausar bot (Kill Switch)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendBotStatus,
  linkTelegramChat,
  unlinkTelegramChat,
  canUseTelegramNotifications,
} from "@/lib/telegram";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

/**
 * Enviar respuesta a Telegram
 */
async function sendTelegramReply(
  chatId: number,
  text: string,
  parseMode: "Markdown" | "HTML" = "HTML"
): Promise<TelegramResponse> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("[Telegram Webhook] BOT_TOKEN no configurado");
    return { ok: false, description: "Bot token not configured" };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Telegram Webhook] Error enviando reply:", error);
    return { ok: false, description: String(error) };
  }
}

/**
 * Manejar comando /start
 * Permite vincular la cuenta del usuario con el chat de Telegram
 */
async function handleStart(
  chatId: number,
  userId: string | null
): Promise<void> {
  if (!userId) {
    await sendTelegramReply(
      chatId,
      `
⚠️ <b>Vinculación requerida</b>

Para usar este bot, necesitas vincular tu cuenta del SaaS.

1. Accede a tu dashboard
2. Ve a Configuración → Telegram
3. Copia el código de vinculación
4. Envíalo aquí con /link TU_CODIGO

Ejemplo: <code>/link abc123def456</code>
      `.trim()
    );
    return;
  }

  // Buscar tenant por telegramChatId
  const tenant = await prisma.tenant.findFirst({
    where: { telegramChatId: String(chatId) },
    include: { botConfigs: true },
  });

  if (!tenant) {
    await sendTelegramReply(
      chatId,
      `
⚠️ <b>Cuenta no vinculada</b>

No encuentro una cuenta vinculada a este chat.
Usa /link TU_CODIGO para vincular tu cuenta.
      `.trim()
    );
    return;
  }

  const canUse = await canUseTelegramNotifications(tenant.id);

  if (!canUse) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Plan no compatible</b>

Las notificaciones de Telegram están disponibles solo para planes PRO y ENTERPRISE.

Actualiza tu plan en el dashboard para activar esta función.
      `.trim()
    );
    return;
  }

  await sendTelegramReply(
    chatId,
    `
✅ <b>Bot activado</b>

Hola <b>${tenant.name}</b>!

Tu cuenta está vinculada correctamente.
Usa /status para ver el estado del bot.
    `.trim()
  );
}

/**
 * Manejar comando /link
 * Vincula el chat con una cuenta del SaaS usando un código de vinculación
 */
async function handleLink(
  chatId: number,
  linkCode: string | null
): Promise<void> {
  if (!linkCode) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Código requerido</b>

Uso: <code>/link TU_CODIGO</code>

Obtén tu código de vinculación en:
Dashboard → Configuración → Telegram
      `.trim()
    );
    return;
  }

  // El código de link es el tenantId (en producción debería ser un código temporal)
  const tenant = await prisma.tenant.findUnique({
    where: { id: linkCode },
  });

  if (!tenant) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Código inválido</b>

El código de vinculación no es válido o ha expirado.
Verifica el código en tu dashboard.
      `.trim()
    );
    return;
  }

  // Verificar plan
  const canUse = await canUseTelegramNotifications(tenant.id);

  if (!canUse) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Plan no compatible</b>

Las notificaciones de Telegram requieren plan PRO o ENTERPRISE.
Actualiza tu plan en el dashboard.
      `.trim()
    );
    return;
  }

  // Vincular chat
  const linked = await linkTelegramChat(tenant.id, String(chatId));

  if (linked) {
    await sendTelegramReply(
      chatId,
      `
✅ <b>Cuenta vinculada</b>

Bienvenido, <b>${tenant.name}</b>!

Tu cuenta está ahora vinculada a este chat.
Recibirás notificaciones de:
• Operaciones abiertas/cerradas
• Errores del bot
• Daily Loss Limit
• Kill Switch

Comandos disponibles:
/status - Estado del bot
/positions - Posiciones abiertas
/balance - Balance y equity
/stop - Pausar bot (emergencia)
      `.trim()
    );
  } else {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Error de vinculación</b>

No se pudo vincular la cuenta. Intenta de nuevo más tarde.
      `.trim()
    );
  }
}

/**
 * Manejar comando /unlink
 * Desvincula el chat de la cuenta
 */
async function handleUnlink(chatId: number): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { telegramChatId: String(chatId) },
  });

  if (!tenant) {
    await sendTelegramReply(
      chatId,
      `
⚠️ <b>Sin vinculación</b>

Este chat no está vinculado a ninguna cuenta.
      `.trim()
    );
    return;
  }

  const unlinked = await unlinkTelegramChat(tenant.id);

  if (unlinked) {
    await sendTelegramReply(
      chatId,
      `
✅ <b>Cuenta desvinculada</b>

Ya no recibirás notificaciones en este chat.
Para vincular nuevamente, usa /link TU_CODIGO.
      `.trim()
    );
  } else {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Error</b>

No se pudo desvincular la cuenta.
      `.trim()
    );
  }
}

/**
 * Manejar comando /status
 * Muestra el estado actual del bot
 */
async function handleStatus(chatId: number): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { telegramChatId: String(chatId) },
    include: {
      botConfigs: {
        include: {
          heartbeats: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!tenant || !tenant.botConfigs) {
    await sendTelegramReply(
      chatId,
      `
⚠️ <b>Sin cuenta vinculada</b>

Usa /link TU_CODIGO para vincular tu cuenta.
      `.trim()
    );
    return;
  }

  const canUse = await canUseTelegramNotifications(tenant.id);
  if (!canUse) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Plan no compatible</b>

Las notificaciones de Telegram requieren plan PRO o ENTERPRISE.
      `.trim()
    );
    return;
  }

  const botConfig = tenant.botConfigs;
  const lastHeartbeat = botConfig.heartbeats[0];

  const statusData = {
    status: botConfig.status,
    mt5Connected: lastHeartbeat?.mt5Connected ?? false,
    openPositions: lastHeartbeat?.openPositions ?? 0,
    balance: lastHeartbeat?.openPositions ?? 0,
    equity: 0,
    dailyPnL: botConfig.dailyLossCurrent,
  };

  // Obtener balance real si hay cuentas
  const accounts = await prisma.botAccount.findMany({
    where: { botConfigId: botConfig.id, isActive: true },
  });

  if (accounts.length > 0) {
    let totalBalance = 0;
    let totalEquity = 0;

    for (const acc of accounts) {
      totalBalance += acc.lastBalance ?? 0;
      totalEquity += acc.lastEquity ?? 0;
    }

    statusData.balance = totalBalance;
    statusData.equity = totalEquity;
  }

  await sendBotStatus(String(chatId), statusData);
}

/**
 * Manejar comando /positions
 * Muestra las posiciones abiertas
 */
async function handlePositions(chatId: number): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { telegramChatId: String(chatId) },
  });

  if (!tenant) {
    await sendTelegramReply(
      chatId,
      `
⚠️ <b>Sin cuenta vinculada</b>

Usa /link TU_CODIGO para vincular tu cuenta.
      `.trim()
    );
    return;
  }

  const canUse = await canUseTelegramNotifications(tenant.id);
  if (!canUse) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Plan no compatible</b>

Las notificaciones de Telegram requieren plan PRO o ENTERPRISE.
      `.trim()
    );
    return;
  }

  // Buscar posiciones abiertas
  const positions = await prisma.botPosition.findMany({
    where: {
      botAccount: {
        botConfig: {
          tenantId: tenant.id,
        },
      },
    },
    orderBy: { openedAt: "desc" },
    take: 10,
  });

  if (positions.length === 0) {
    await sendTelegramReply(
      chatId,
      `
📊 <b>Posiciones Abiertas</b>

No hay posiciones abiertas actualmente.
      `.trim()
    );
    return;
  }

  let text = `
📊 <b>Posiciones Abiertas</b> (${positions.length})
`;

  for (const pos of positions) {
    const sideEmoji = pos.side === "BUY" ? "🟢" : "🔴";
    const pnl = pos.unrealizedPL ?? 0;
    const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);

    text += `
${sideEmoji} <b>${pos.symbol}</b> ${pos.side}
   Precio: ${pos.openPrice.toFixed(2)}
   Lote: ${pos.lotSize}
   Nivel: ${pos.level}
   P&L: ${pnlStr} EUR
`;
  }

  await sendTelegramReply(chatId, text.trim());
}

/**
 * Manejar comando /balance
 * Muestra balance y equity de las cuentas
 */
async function handleBalance(chatId: number): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { telegramChatId: String(chatId) },
    include: { botConfigs: true },
  });

  if (!tenant || !tenant.botConfigs) {
    await sendTelegramReply(
      chatId,
      `
⚠️ <b>Sin cuenta vinculada</b>

Usa /link TU_CODIGO para vincular tu cuenta.
      `.trim()
    );
    return;
  }

  const canUse = await canUseTelegramNotifications(tenant.id);
  if (!canUse) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Plan no compatible</b>

Las notificaciones de Telegram requieren plan PRO o ENTERPRISE.
      `.trim()
    );
    return;
  }

  const accounts = await prisma.botAccount.findMany({
    where: {
      botConfigId: tenant.botConfigs.id,
      isActive: true,
    },
  });

  if (accounts.length === 0) {
    await sendTelegramReply(
      chatId,
      `
💰 <b>Balance</b>

No hay cuentas configuradas.
Ve al dashboard para añadir cuentas de trading.
      `.trim()
    );
    return;
  }

  let text = `
💰 <b>Balance de Cuentas</b>
`;

  let totalBalance = 0;
  let totalEquity = 0;

  for (const acc of accounts) {
    const balance = acc.lastBalance ?? 0;
    const equity = acc.lastEquity ?? 0;
    totalBalance += balance;
    totalEquity += equity;

    text += `
📤 <b>Cuenta ${acc.id.slice(0, 8)}</b>
   Balance: ${balance.toFixed(2)} EUR
   Equity: ${equity.toFixed(2)} EUR
   Margin: ${(acc.lastMargin ?? 0).toFixed(2)} EUR
`;
  }

  text += `
───────────────
<b>Total Balance:</b> ${totalBalance.toFixed(2)} EUR
<b>Total Equity:</b> ${totalEquity.toFixed(2)} EUR
<b>P&L Flotante:</b> ${(totalEquity - totalBalance).toFixed(2)} EUR
`;

  await sendTelegramReply(chatId, text.trim());
}

/**
 * Manejar comando /stop
 * Activa el Kill Switch (cierra todas las posiciones y pausa)
 */
async function handleStop(chatId: number): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { telegramChatId: String(chatId) },
    include: { botConfigs: true },
  });

  if (!tenant || !tenant.botConfigs) {
    await sendTelegramReply(
      chatId,
      `
⚠️ <b>Sin cuenta vinculada</b>

Usa /link TU_CODIGO para vincular tu cuenta.
      `.trim()
    );
    return;
  }

  const canUse = await canUseTelegramNotifications(tenant.id);
  if (!canUse) {
    await sendTelegramReply(
      chatId,
      `
❌ <b>Plan no compatible</b>

Las notificaciones de Telegram requieren plan PRO o ENTERPRISE.
      `.trim()
    );
    return;
  }

  const botConfig = tenant.botConfigs;

  // Activar kill switch
  await prisma.botConfig.update({
    where: { id: botConfig.id },
    data: { status: "KILL_REQUESTED" },
  });

  await sendTelegramReply(
    chatId,
    `
🚨 <b>KILL SWITCH ACTIVADO</b>

El bot cerrará todas las posiciones y se pausará.
Este proceso puede tardar unos segundos.

Verifica el estado con /status
    `.trim()
  );
}

/**
 * Manejar comando /help
 */
async function handleHelp(chatId: number): Promise<void> {
  await sendTelegramReply(
    chatId,
    `
📖 <b>Comandos disponibles</b>

/start - Iniciar bot y verificar vinculación
/link CODIGO - Vincular tu cuenta del SaaS
/unlink - Desvincular cuenta
/status - Estado del bot
/positions - Posiciones abiertas
/balance - Balance y equity
/stop - Activar Kill Switch (emergencia)
/help - Mostrar esta ayuda

⚠️ <b>Nota:</b> Los comandos requieren plan PRO o ENTERPRISE.
    `.trim()
  );
}

/**
 * POST handler - Recibe updates de Telegram
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as TelegramUpdate;

    // Verificar que es un mensaje
    if (!body.message || !body.message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text.trim();

    console.log(`[Telegram Webhook] Received: ${text} from chat ${chatId}`);

    // Parsear comando
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Manejar comandos
    switch (command) {
      case "/start":
        await handleStart(chatId, args[0] ?? null);
        break;

      case "/link":
        await handleLink(chatId, args[0] ?? null);
        break;

      case "/unlink":
        await handleUnlink(chatId);
        break;

      case "/status":
        await handleStatus(chatId);
        break;

      case "/positions":
        await handlePositions(chatId);
        break;

      case "/balance":
        await handleBalance(chatId);
        break;

      case "/stop":
        await handleStop(chatId);
        break;

      case "/help":
        await handleHelp(chatId);
        break;

      default:
        await sendTelegramReply(
          chatId,
          `
❓ <b>Comando no reconocido</b>

Usa /help para ver los comandos disponibles.
          `.trim()
        );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET handler - Para verificar webhook (opcional)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "set") {
    // Set webhook URL
    const webhookUrl = searchParams.get("url");
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "url parameter required" },
        { status: 400 }
      );
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: "Bot token not configured" },
        { status: 500 }
      );
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  }

  if (action === "info") {
    // Get webhook info
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: "Bot token not configured" },
        { status: 500 }
      );
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
    const response = await fetch(url);
    const data = await response.json();
    return NextResponse.json(data);
  }

  if (action === "delete") {
    // Delete webhook
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: "Bot token not configured" },
        { status: 500 }
      );
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`;
    const response = await fetch(url);
    const data = await response.json();
    return NextResponse.json(data);
  }

  return NextResponse.json({
    status: "ok",
    message: "Telegram webhook endpoint active",
    endpoints: {
      webhook: "POST /api/telegram/webhook",
      setWebhook: "GET /api/telegram/webhook?action=set&url=YOUR_URL",
      getInfo: "GET /api/telegram/webhook?action=info",
      deleteWebhook: "GET /api/telegram/webhook?action=delete",
    },
  });
}
