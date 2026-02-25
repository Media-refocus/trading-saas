/**
 * API Endpoint: /api/telegram/setup
 * ==================================
 *
 * GET: Devuelve la configuracion actual de Telegram del usuario
 * POST: Guarda el chat ID de Telegram del usuario
 * PUT: Actualiza preferencias de notificacion
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  sendTelegramMessage,
  formatTestMessage,
  formatWelcomeMessage,
  verifyBotToken,
} from "@/lib/telegram-notifications";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener tenant del usuario
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Verificar estado del bot
    const botStatus = await verifyBotToken();

    return NextResponse.json({
      success: true,
      config: {
        chatId: user.tenant.telegramChatId,
        notificationsEnabled: user.tenant.telegramNotificationsEnabled,
      },
      bot: botStatus.valid
        ? {
            configured: true,
            username: botStatus.botInfo?.username,
            name: botStatus.botInfo?.name,
          }
        : {
            configured: false,
            error: botStatus.error,
          },
    });
  } catch (error) {
    console.error("[Telegram Setup] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, sendWelcome = false } = body;

    if (!chatId || typeof chatId !== "string") {
      return NextResponse.json(
        { error: "Chat ID es requerido" },
        { status: 400 }
      );
    }

    // Obtener tenant del usuario
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Actualizar configuracion de Telegram
    const updatedTenant = await prisma.tenant.update({
      where: { id: user.tenant.id },
      data: {
        telegramChatId: chatId,
        telegramNotificationsEnabled: true,
      },
    });

    // Enviar mensaje de bienvenida si se solicita
    if (sendWelcome) {
      const userName = user.name || session.user.email.split("@")[0];
      await sendTelegramMessage(chatId, formatWelcomeMessage(userName));
    }

    console.log(`[Telegram Setup] Chat ID configurado para tenant ${user.tenant.id}`);

    return NextResponse.json({
      success: true,
      message: "Chat ID configurado correctamente",
      config: {
        chatId: updatedTenant.telegramChatId,
        notificationsEnabled: updatedTenant.telegramNotificationsEnabled,
      },
    });
  } catch (error) {
    console.error("[Telegram Setup] Error guardando chat ID:", error);
    return NextResponse.json(
      { error: "Error guardando configuracion" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationsEnabled } = body;

    if (typeof notificationsEnabled !== "boolean") {
      return NextResponse.json(
        { error: "notificationsEnabled debe ser boolean" },
        { status: 400 }
      );
    }

    // Obtener tenant del usuario
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Actualizar preferencia de notificaciones
    const updatedTenant = await prisma.tenant.update({
      where: { id: user.tenant.id },
      data: {
        telegramNotificationsEnabled: notificationsEnabled,
      },
    });

    return NextResponse.json({
      success: true,
      message: notificationsEnabled
        ? "Notificaciones activadas"
        : "Notificaciones desactivadas",
      config: {
        chatId: updatedTenant.telegramChatId,
        notificationsEnabled: updatedTenant.telegramNotificationsEnabled,
      },
    });
  } catch (error) {
    console.error("[Telegram Setup] Error actualizando preferencias:", error);
    return NextResponse.json(
      { error: "Error actualizando preferencias" },
      { status: 500 }
    );
  }
}

/**
 * Endpoint para enviar mensaje de prueba
 */
export async function PATCH() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener tenant del usuario
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    if (!user.tenant.telegramChatId) {
      return NextResponse.json(
        { error: "No hay chat ID configurado" },
        { status: 400 }
      );
    }

    // Enviar mensaje de prueba
    const result = await sendTelegramMessage(
      user.tenant.telegramChatId,
      formatTestMessage()
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error enviando mensaje" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Mensaje de prueba enviado correctamente",
    });
  } catch (error) {
    console.error("[Telegram Setup] Error enviando prueba:", error);
    return NextResponse.json(
      { error: "Error enviando mensaje de prueba" },
      { status: 500 }
    );
  }
}
