import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getTenantPlanLimits, applyPlanLimits } from "@/lib/plans";

/**
 * GET /api/bot/settings
 * Obtiene la configuración del bot para mostrar en el dashboard
 * (autenticación por sesión de usuario, no por API key)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenant: {
          include: { botConfigs: true, plan: true }
        }
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const botConfig = user.tenant.botConfigs[0];

    // Obtener límites del plan usando el nuevo módulo
    const planLimits = await getTenantPlanLimits(user.tenant.id);

    // Si no hay config, devolver defaults
    if (!botConfig) {
      return NextResponse.json({
        success: true,
        config: null,
        planLimits: {
          maxLevels: planLimits.maxLevels,
          maxPositions: planLimits.maxPositions,
          hasTrailingSL: planLimits.hasTrailingSL,
          hasAdvancedGrid: planLimits.hasAdvancedGrid,
        },
        planName: planLimits.planName,
      });
    }

    // Devolver config con límites del plan
    return NextResponse.json({
      success: true,
      config: {
        lotSize: botConfig.lotSize,
        maxLevels: botConfig.maxLevels,
        gridDistance: botConfig.gridDistance,
        takeProfit: botConfig.takeProfit,
        trailingActivate: botConfig.trailingActivate,
        trailingStep: botConfig.trailingStep,
        trailingBack: botConfig.trailingBack,
        defaultRestriction: botConfig.defaultRestriction,
        paperTradingMode: botConfig.paperTradingMode,
        isActive: botConfig.isActive,
      },
      planLimits: {
        maxLevels: planLimits.maxLevels,
        maxPositions: planLimits.maxPositions,
        hasTrailingSL: planLimits.hasTrailingSL,
        hasAdvancedGrid: planLimits.hasAdvancedGrid,
      },
      planName: planLimits.planName,
    });
  } catch (error) {
    console.error("Error obteniendo settings:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bot/settings
 * Actualiza la configuración del bot desde el dashboard
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      lotSize,
      maxLevels,
      gridDistance,
      takeProfit,
      trailingActivate,
      trailingStep,
      trailingBack,
      defaultRestriction,
      paperTradingMode,
    } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenant: {
          include: { botConfigs: true }
        }
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const botConfig = user.tenant.botConfigs[0];

    if (!botConfig) {
      return NextResponse.json(
        { error: "Primero debes generar una API key en /setup" },
        { status: 400 }
      );
    }

    // Aplicar límites del plan
    const { config: limitedConfig, warnings, limited } = await applyPlanLimits(
      user.tenant.id,
      {
        maxLevels: maxLevels ?? 3,
        trailingActivate,
        trailingStep,
        trailingBack,
      }
    );

    // Validaciones básicas
    const validatedLotSize = Math.max(0.01, Math.min(lotSize ?? 0.01, 1.0));
    const validatedMaxLevels = Math.max(1, limitedConfig.maxLevels ?? 3);
    const validatedGridDistance = Math.max(5, Math.min(gridDistance ?? 10, 100));
    const validatedTakeProfit = Math.max(5, Math.min(takeProfit ?? 20, 200));

    // Validar restricción
    const validRestrictions = ["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO", null];
    const validatedRestriction = validRestrictions.includes(defaultRestriction)
      ? defaultRestriction
      : null;

    // Validar paperTradingMode (booleano)
    const validatedPaperTradingMode = typeof paperTradingMode === "boolean" ? paperTradingMode : false;

    // Actualizar config
    const updated = await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        lotSize: validatedLotSize,
        maxLevels: validatedMaxLevels,
        gridDistance: validatedGridDistance,
        takeProfit: validatedTakeProfit,
        trailingActivate: limitedConfig.trailingActivate ?? null,
        trailingStep: limitedConfig.trailingStep ?? null,
        trailingBack: limitedConfig.trailingBack ?? null,
        defaultRestriction: validatedRestriction,
        paperTradingMode: validatedPaperTradingMode,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        lotSize: updated.lotSize,
        maxLevels: updated.maxLevels,
        gridDistance: updated.gridDistance,
        takeProfit: updated.takeProfit,
        trailingActivate: updated.trailingActivate,
        trailingStep: updated.trailingStep,
        trailingBack: updated.trailingBack,
        defaultRestriction: updated.defaultRestriction,
        paperTradingMode: updated.paperTradingMode,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      limited,
      message: limited
        ? "Configuracion actualizada con ajustes por limites del plan."
        : "Configuracion actualizada. El bot aplicara los cambios automaticamente.",
    });
  } catch (error) {
    console.error("Error actualizando settings:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
