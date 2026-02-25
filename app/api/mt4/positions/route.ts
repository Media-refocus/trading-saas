/**
 * API MT4 - Reportar Posiciones
 * ==============================
 *
 * POST: El EA reporta sus posiciones abiertas
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, symbol, positions } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key requerida" },
        { status: 400 }
      );
    }

    // Verificar API key
    const botConfig = await prisma.botConfig.findFirst({
      where: { apiKeyPlain: apiKey },
      include: { tenant: true },
    });

    if (!botConfig) {
      return NextResponse.json({ error: "API Key inválida" }, { status: 401 });
    }

    // Sincronizar posiciones
    // Por cada posición reportada, actualizar o crear en la BD
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        // Buscar si ya existe esta posición
        const existingPos = await prisma.position.findFirst({
          where: {
            tenantId: botConfig.tenantId,
            status: "OPEN",
          },
        });

        if (existingPos) {
          // Actualizar
          await prisma.position.update({
            where: { id: existingPos.id },
            data: {
              profitMoney: pos.profit,
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      syncedPositions: positions?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error reportando posiciones MT4:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
