/**
 * POST /api/bot/auth
 * Autentica un bot usando su API key
 *
 * Este endpoint es especial: valida la API key pero NO usa el middleware estándar
 * porque es el punto de entrada inicial del bot.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  logAuditEvent,
  isValidApiKeyFormat,
  hashApiKey,
} from "@/lib/security";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key requerida", code: "MISSING_API_KEY" },
        { status: 400 }
      );
    }

    // Obtener contexto del request para auditoría
    const context = {
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
      endpoint: "/api/bot/auth",
    };

    // Validar API key completa (formato, estado, suscripción, rate limit)
    const validation = await validateApiKey(
      apiKey,
      "/api/bot/auth",
      context.ipAddress
    );

    if (!validation.valid) {
      const errorCode: Record<string, string> = {
        INVALID_FORMAT: "INVALID_KEY_FORMAT",
        API_KEY_NOT_FOUND: "INVALID_API_KEY",
        API_KEY_REVOKED: "KEY_REVOKED",
        API_KEY_EXPIRED: "KEY_EXPIRED",
        SUBSCRIPTION_INACTIVE: "SUBSCRIPTION_REQUIRED",
        SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
        GRACE_PERIOD_EXPIRED: "GRACE_PERIOD_EXPIRED",
        RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
      };

      const statusCode = validation.reason === "RATE_LIMIT_EXCEEDED" ? 429 : 401;

      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(validation.reason),
          code: errorCode[validation.reason || "INVALID_API_KEY"],
          tenantId: validation.tenantId,
        },
        { status: statusCode }
      );
    }

    // Obtener config completa para devolver al bot
    const botConfig = await prisma.botConfig.findUnique({
      where: { id: validation.botConfigId! },
      include: {
        tenant: true,
      },
    });

    // Devolver configuración
    return NextResponse.json({
      success: true,
      tenantId: validation.tenantId,
      config: {
        // Configuración de trading
        lotSize: botConfig?.lotSize ?? 0.01,
        gridDistance: botConfig?.gridDistance ?? 10.0,
        takeProfit: botConfig?.takeProfit ?? 20.0,
        maxLevels: validation.maxLevels ?? 3,
        maxPositions: validation.maxPositions ?? 1,

        // Trailing SL
        trailingActivate: botConfig?.trailingActivate,
        trailingStep: botConfig?.trailingStep,
        trailingBack: botConfig?.trailingBack,

        // Restricciones
        defaultRestriction: botConfig?.defaultRestriction,

        // Paper Trading
        paperTradingMode: botConfig?.paperTradingMode ?? false,

        // Features del plan
        hasTrailingSL: validation.hasTrailingSL ?? true,

        // Info del tenant
        tenantName: botConfig?.tenant.name,
        planName: validation.planName ?? "Sin plan",
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

/**
 * Mensajes de error user-friendly
 */
function getErrorMessage(reason?: string): string {
  const messages: Record<string, string> = {
    INVALID_FORMAT: "Formato de API key inválido",
    API_KEY_NOT_FOUND: "API key no encontrada",
    API_KEY_REVOKED: "API key revocada. Genera una nueva desde el dashboard.",
    API_KEY_EXPIRED: "API key expirada. Renueva tu suscripción.",
    SUBSCRIPTION_INACTIVE: "Suscripción inactiva. Activa tu plan para continuar.",
    SUBSCRIPTION_EXPIRED: "Suscripción vencida. Renueva para continuar operando.",
    GRACE_PERIOD_EXPIRED: "Período de gracia finalizado. Renueva tu suscripción.",
    RATE_LIMIT_EXCEEDED: "Límite de requests excedido. Espera un momento.",
  };

  return messages[reason || "API_KEY_NOT_FOUND"] || "Error de autenticación";
}
