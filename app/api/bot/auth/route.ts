import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * POST /api/bot/auth
 * Autentica un bot usando su API key
 *
 * Request: { apiKey: string }
 * Response: { success: boolean, tenantId?: string, config?: BotConfig, error?: string }
 */
export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key requerida" },
        { status: 400 }
      );
    }

    // Hash del API key para comparar
    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Buscar configuración del bot
    const botConfig = await prisma.botConfig.findUnique({
      where: { apiKey: hashedKey },
      include: {
        tenant: {
          include: {
            plan: true,
            subscriptions: {
              where: { status: "ACTIVE" },
              take: 1,
            },
          },
        },
      },
    });

    if (!botConfig) {
      return NextResponse.json(
        { success: false, error: "API key inválida" },
        { status: 401 }
      );
    }

    // Verificar que el bot está activo
    if (!botConfig.isActive) {
      return NextResponse.json(
        { success: false, error: "Bot desactivado. Contacte soporte." },
        { status: 403 }
      );
    }

    // Verificar suscripción activa
    const activeSubscription = botConfig.tenant.subscriptions[0];
    if (!activeSubscription && botConfig.tenant.planId) {
      return NextResponse.json(
        { success: false, error: "Suscripción inactiva. Renueve para continuar." },
        { status: 403 }
      );
    }

    // Obtener límites del plan
    const plan = botConfig.tenant.plan;
    const maxLevels = plan?.maxLevels ?? botConfig.maxLevels;
    const maxPositions = plan?.maxPositions ?? 1;

    // Actualizar último heartbeat
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: { lastHeartbeat: new Date() },
    });

    // Devolver configuración
    return NextResponse.json({
      success: true,
      tenantId: botConfig.tenantId,
      config: {
        // Configuración de trading
        lotSize: botConfig.lotSize,
        gridDistance: botConfig.gridDistance,
        takeProfit: botConfig.takeProfit,
        maxLevels: Math.min(maxLevels, botConfig.maxLevels),
        maxPositions,

        // Trailing SL
        trailingActivate: botConfig.trailingActivate,
        trailingStep: botConfig.trailingStep,
        trailingBack: botConfig.trailingBack,

        // Restricciones
        defaultRestriction: botConfig.defaultRestriction,

        // Features del plan
        hasTrailingSL: plan?.hasTrailingSL ?? true,
        hasAdvancedGrid: plan?.hasAdvancedGrid ?? false,

        // Info del tenant
        tenantName: botConfig.tenant.name,
        planName: plan?.name ?? "Sin plan",
      },
    });
  } catch (error) {
    console.error("Error en autenticación de bot:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
