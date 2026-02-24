import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * GET /api/bot/config
 * Obtiene la configuración actual del bot (sin necesidad de re-autenticar)
 *
 * Headers: Authorization: Bearer <apiKey>
 */
export async function GET(request: Request) {
  try {
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
      include: {
        tenant: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!botConfig) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const plan = botConfig.tenant.plan;
    const maxLevels = plan?.maxLevels ?? botConfig.maxLevels;
    const maxPositions = plan?.maxPositions ?? 1;

    return NextResponse.json({
      success: true,
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

        // Estado
        isActive: botConfig.isActive,
        lastUpdated: botConfig.updatedAt.toISOString(),
      },
      plan: plan
        ? {
            name: plan.name,
            price: plan.price,
            currency: plan.currency,
          }
        : null,
    });
  } catch (error) {
    console.error("Error obteniendo config:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bot/config
 * Actualiza la configuración del bot (desde el dashboard del cliente)
 *
 * Headers: Authorization: Bearer <apiKey>
 * Body: Partial<BotConfig>
 */
export async function PUT(request: Request) {
  try {
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
      include: { tenant: { include: { plan: true } } },
    });

    if (!botConfig) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const data = await request.json();
    const plan = botConfig.tenant.plan;

    // Validar límites del plan
    const maxLevels = plan?.maxLevels ?? 3;
    if (data.maxLevels && data.maxLevels > maxLevels) {
      return NextResponse.json(
        {
          success: false,
          error: `maxLevels excede el límite del plan (${maxLevels})`,
        },
        { status: 400 }
      );
    }

    // Actualizar solo campos permitidos
    const updateData: Record<string, unknown> = {};

    if (data.lotSize !== undefined) updateData.lotSize = data.lotSize;
    if (data.gridDistance !== undefined) updateData.gridDistance = data.gridDistance;
    if (data.takeProfit !== undefined) updateData.takeProfit = data.takeProfit;
    if (data.maxLevels !== undefined) updateData.maxLevels = Math.min(data.maxLevels, maxLevels);
    if (data.trailingActivate !== undefined) updateData.trailingActivate = data.trailingActivate;
    if (data.trailingStep !== undefined) updateData.trailingStep = data.trailingStep;
    if (data.trailingBack !== undefined) updateData.trailingBack = data.trailingBack;
    if (data.defaultRestriction !== undefined) updateData.defaultRestriction = data.defaultRestriction;

    const updated = await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      config: {
        lotSize: updated.lotSize,
        gridDistance: updated.gridDistance,
        takeProfit: updated.takeProfit,
        maxLevels: updated.maxLevels,
        trailingActivate: updated.trailingActivate,
        trailingStep: updated.trailingStep,
        trailingBack: updated.trailingBack,
        defaultRestriction: updated.defaultRestriction,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error actualizando config:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
