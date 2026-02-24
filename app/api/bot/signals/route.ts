import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * GET /api/bot/signals
 * Obtiene señales pendientes para el bot autenticado
 *
 * Headers: Authorization: Bearer <apiKey>
 * Query: since?: ISO timestamp (opcional, para obtener señales desde una fecha)
 *
 * Response: { success: boolean, signals?: Signal[], error?: string }
 */
export async function GET(request: Request) {
  try {
    // Obtener API key del header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authorization header requerido" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Verificar API key
    const botConfig = await prisma.botConfig.findUnique({
      where: { apiKey: hashedKey },
      include: { tenant: true },
    });

    if (!botConfig || !botConfig.isActive) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Parsear parámetro "since"
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");

    // Obtener señales pendientes para este tenant
    const pendingDeliveries = await prisma.signalDelivery.findMany({
      where: {
        tenantId: botConfig.tenantId,
        status: "PENDING",
        ...(since && {
          globalSignal: {
            receivedAt: { gte: new Date(since) },
          },
        }),
      },
      include: {
        globalSignal: true,
      },
      orderBy: {
        globalSignal: {
          receivedAt: "asc",
        },
      },
      take: 50, // Máximo 50 señales por request
    });

    // Marcar como entregadas
    if (pendingDeliveries.length > 0) {
      await prisma.signalDelivery.updateMany({
        where: {
          id: { in: pendingDeliveries.map((d) => d.id) },
        },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
      });
    }

    // Formatear señales para el bot
    const signals = pendingDeliveries.map((d) => ({
      id: d.globalSignal.id,
      type: d.globalSignal.type,
      side: d.globalSignal.side,
      price: d.globalSignal.price,
      symbol: d.globalSignal.symbol,
      restriction: d.globalSignal.restriction,
      messageText: d.globalSignal.messageText,
      receivedAt: d.globalSignal.receivedAt.toISOString(),
      deliveryId: d.id,
    }));

    return NextResponse.json({
      success: true,
      count: signals.length,
      signals,
    });
  } catch (error) {
    console.error("Error obteniendo señales:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bot/signals
 * Marca una señal como ejecutada (o fallida)
 *
 * Headers: Authorization: Bearer <apiKey>
 * Body: { deliveryId: string, status: "EXECUTED" | "FAILED", error?: string }
 */
export async function POST(request: Request) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authorization header requerido" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

    const botConfig = await prisma.botConfig.findUnique({
      where: { apiKey: hashedKey },
    });

    if (!botConfig) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { deliveryId, status, error } = await request.json();

    if (!deliveryId || !["EXECUTED", "FAILED"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "deliveryId y status (EXECUTED|FAILED) requeridos" },
        { status: 400 }
      );
    }

    // Actualizar estado de la entrega
    await prisma.signalDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        executedAt: new Date(),
        error: status === "FAILED" ? error : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error actualizando señal:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
