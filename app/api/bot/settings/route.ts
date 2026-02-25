import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
    const plan = user.tenant.plan;

    // Si no hay config, devolver defaults
    if (!botConfig) {
      return NextResponse.json({
        success: true,
        config: null,
        planLimits: {
          maxLevels: plan?.maxLevels ?? 3,
          maxPositions: plan?.maxPositions ?? 1,
          hasTrailingSL: plan?.hasTrailingSL ?? true,
          hasAdvancedGrid: plan?.hasAdvancedGrid ?? false,
        },
        planName: plan?.name ?? "Sin plan",
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
        maxLevels: plan?.maxLevels ?? 3,
        maxPositions: plan?.maxPositions ?? 1,
        hasTrailingSL: plan?.hasTrailingSL ?? true,
        hasAdvancedGrid: plan?.hasAdvancedGrid ?? false,
      },
      planName: plan?.name ?? "Sin plan",
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
          include: { botConfigs: true, plan: true }
        }
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const plan = user.tenant.plan;
    const planMaxLevels = plan?.maxLevels ?? 3;

    // Validaciones
    const validatedLotSize = Math.max(0.01, Math.min(lotSize ?? 0.01, 1.0));
    const validatedMaxLevels = Math.max(1, Math.min(maxLevels ?? 3, planMaxLevels));
    const validatedGridDistance = Math.max(5, Math.min(gridDistance ?? 10, 100));
    const validatedTakeProfit = Math.max(5, Math.min(takeProfit ?? 20, 200));

    // Validar trailing según plan
    let validatedTrailingActivate = trailingActivate;
    let validatedTrailingStep = trailingStep;
    let validatedTrailingBack = trailingBack;

    if (plan && !plan.hasTrailingSL) {
      validatedTrailingActivate = null;
      validatedTrailingStep = null;
      validatedTrailingBack = null;
    } else {
      if (trailingActivate !== null && trailingActivate !== undefined) {
        validatedTrailingActivate = Math.max(0, Math.min(trailingActivate, 100));
      }
      if (trailingStep !== null && trailingStep !== undefined) {
        validatedTrailingStep = Math.max(5, Math.min(trailingStep, 50));
      }
      if (trailingBack !== null && trailingBack !== undefined) {
        validatedTrailingBack = Math.max(10, Math.min(trailingBack, 100));
      }
    }

    // Validar restricción
    const validRestrictions = ["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO", null];
    const validatedRestriction = validRestrictions.includes(defaultRestriction)
      ? defaultRestriction
      : null;

    // Validar paperTradingMode (booleano)
    const validatedPaperTradingMode = typeof paperTradingMode === "boolean" ? paperTradingMode : false;

    const botConfig = user.tenant.botConfigs[0];

    if (!botConfig) {
      return NextResponse.json(
        { error: "Primero debes generar una API key en /setup" },
        { status: 400 }
      );
    }

    // Actualizar config
    const updated = await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        lotSize: validatedLotSize,
        maxLevels: validatedMaxLevels,
        gridDistance: validatedGridDistance,
        takeProfit: validatedTakeProfit,
        trailingActivate: validatedTrailingActivate,
        trailingStep: validatedTrailingStep,
        trailingBack: validatedTrailingBack,
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
      message: "Configuracion actualizada. El bot aplicara los cambios automaticamente.",
    });
  } catch (error) {
    console.error("Error actualizando settings:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
