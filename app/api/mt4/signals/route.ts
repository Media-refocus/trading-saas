/**
 * API MT4 - Obtener Señales
 * ==========================
 *
 * GET: Devuelve señales pendientes para el EA
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.nextUrl.searchParams.get("apiKey");
    const symbol = request.nextUrl.searchParams.get("symbol") || "XAUUSD";

    if (!apiKey) {
      return NextResponse.json({ error: "API Key requerida" }, { status: 401 });
    }

    // Verificar API key y obtener tenant
    const botConfig = await prisma.botConfig.findFirst({
      where: { apiKeyPlain: apiKey },
      include: { tenant: true },
    });

    if (!botConfig) {
      return NextResponse.json({ error: "API Key inválida" }, { status: 401 });
    }

    // Obtener señales pendientes para este tenant
    const pendingSignals = await prisma.signalDelivery.findMany({
      where: {
        tenantId: botConfig.tenantId,
        status: "PENDING",
        globalSignal: {
          symbol: symbol,
        },
      },
      include: {
        globalSignal: true,
      },
      orderBy: { createdAt: "asc" },
      take: 10, // Máximo 10 señales por petición
    });

    // Formatear señales para el EA
    const signals = pendingSignals.map((delivery) => {
      const signal = delivery.globalSignal;
      return {
        id: signal.id,
        action: signal.type, // "ENTRY", "CLOSE_RANGE", etc.
        side: signal.side,   // "BUY", "SELL"
        symbol: signal.symbol,
        price: signal.price,
        restriction: signal.restriction,
        timestamp: signal.receivedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      signals,
      count: signals.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error obteniendo señales MT4:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
