/**
 * API MT4 - Confirmar Señal
 * ==========================
 *
 * POST: Confirma que una señal fue ejecutada por el EA
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, signalId, ticket, status, message } = body;

    if (!apiKey || !signalId) {
      return NextResponse.json(
        { error: "API Key y signalId son requeridos" },
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

    // Actualizar estado de la señal
    const delivery = await prisma.signalDelivery.updateMany({
      where: {
        globalSignalId: signalId,
        tenantId: botConfig.tenantId,
      },
      data: {
        status: status === "EXECUTED" ? "EXECUTED" : "FAILED",
        executedAt: new Date(),
        error: message || null,
      },
    });

    // Si se ejecutó, crear registro de posición
    if (status === "EXECUTED" && ticket) {
      // Crear posición en la base de datos
      await prisma.signalDelivery.update({
        where: {
          globalSignalId_tenantId: {
            globalSignalId: signalId,
            tenantId: botConfig.tenantId,
          },
        },
        data: {
          // Metadata adicional si es necesario
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Señal confirmada",
      signalId,
      ticket,
    });
  } catch (error) {
    console.error("Error confirmando señal MT4:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
