import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { auth } from "@/lib/auth";

/**
 * GET /api/bot/apikey
 * Obtiene el estado de la API key del usuario autenticado
 * (no devuelve la key completa por seguridad)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: { include: { botConfigs: true, plan: true } } },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const botConfig = user.tenant.botConfigs[0];

    return NextResponse.json({
      success: true,
      hasApiKey: !!botConfig,
      isActive: botConfig?.isActive ?? false,
      lastHeartbeat: botConfig?.lastHeartbeat?.toISOString(),
      plan: user.tenant.plan
        ? {
            name: user.tenant.plan.name,
            maxLevels: user.tenant.plan.maxLevels,
            maxPositions: user.tenant.plan.maxPositions,
          }
        : null,
    });
  } catch (error) {
    console.error("Error obteniendo API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bot/apikey
 * Genera una nueva API key para el usuario autenticado
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: { include: { plan: true } } },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Generar API key aleatoria
    const apiKeyPlain = `tb_${crypto.randomBytes(32).toString("hex")}`;
    const apiKeyHash = crypto.createHash("sha256").update(apiKeyPlain).digest("hex");

    // Obtener límites del plan
    const plan = user.tenant.plan;
    const maxLevels = plan?.maxLevels ?? 3;

    // Crear o actualizar BotConfig
    const existingConfig = await prisma.botConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (existingConfig) {
      // Actualizar API key existente
      await prisma.botConfig.update({
        where: { id: existingConfig.id },
        data: { apiKey: apiKeyHash },
      });
    } else {
      // Crear nuevo BotConfig
      await prisma.botConfig.create({
        data: {
          tenantId: user.tenantId,
          apiKey: apiKeyHash,
          maxLevels,
          lotSize: 0.01,
          gridDistance: 10.0,
          takeProfit: 20.0,
          trailingActivate: 30.0,
          trailingStep: 10.0,
          trailingBack: 20.0,
        },
      });
    }

    // IMPORTANTE: Devolver la API key en texto plano SOLO una vez
    // No se puede recuperar después
    return NextResponse.json({
      success: true,
      apiKey: apiKeyPlain,
      warning: "Guarda esta API key en un lugar seguro. No se podrá volver a ver.",
      config: {
        maxLevels,
        lotSize: 0.01,
        gridDistance: 10.0,
        takeProfit: 20.0,
      },
    });
  } catch (error) {
    console.error("Error generando API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bot/apikey
 * Revoca la API key actual
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Desactivar el bot
    await prisma.botConfig.updateMany({
      where: { tenantId: user.tenantId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "API key desactivada",
    });
  } catch (error) {
    console.error("Error revocando API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
