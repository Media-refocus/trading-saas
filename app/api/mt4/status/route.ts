/**
 * API MT4 - Reportar Estado
 * ==========================
 *
 * POST: El EA reporta su estado actual
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, status, message, openPositions, totalProfit, symbol } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key requerida" },
        { status: 400 }
      );
    }

    // Verificar API key
    const botConfig = await prisma.botConfig.findFirst({
      where: { apiKeyPlain: apiKey },
    });

    if (!botConfig) {
      return NextResponse.json({ error: "API Key inválida" }, { status: 401 });
    }

    // Crear heartbeat
    await prisma.botHeartbeat.create({
      data: {
        tenantId: botConfig.tenantId,
        status: status || "RUNNING",
        mt5Connected: true, // MT4 conectado
        telegramOk: true,
        openPositions: openPositions || 0,
        totalProfit: totalProfit || 0,
        error: message || null,
        platform: "MT4",
        receivedAt: new Date(),
      },
    });

    // Actualizar último heartbeat del botConfig
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: { lastHeartbeat: new Date() },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error reportando estado MT4:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
